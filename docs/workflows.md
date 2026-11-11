# Workflow runtime

For maintainers. This covers the `workflows/` code on both sides: how a
command runs, how its changes become events, and how the frontend turns
those events into fresh data.

- How commands are defined and compiled is in
  [command-composition.md](command-composition.md).
- The README's [How data flows](../README.md#how-data-flows) walks through
  one write and one read. This doc is the reference behind it.

"Workflow" also names the `execution: 'workflow'` definition kind (commands
in sequence, each committing on its own). That kind is covered in
[command-composition.md](command-composition.md#workflows).

## Principles

- **The backend owns every write.** The frontend sends a command and never
  edits server data locally.
- **One command, one transaction.** Every backend change runs as one
  compiled plan inside one synchronous SQLite transaction.
- **Events after commit.** Nothing is published until the transaction
  commits. A rollback drops queued events.
- **Events drive reads.** Fresh frontend data comes from committed events,
  whichever window or process caused them. Zustand holds UI state only,
  never entity rows.
- **Never repeat a write.** If events are lost, the frontend re-reads.
  It never sends the write again.
- **Failures after commit stay visible.** A failing listener, cleanup or
  refresh is logged or shown as a warning. It never turns a saved write
  into a failed one.

## Modules

| Module                                                           | Responsibility                                                                                            |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `common/workflows/runtime.ts`                                    | `createRuntime`: typed `commands.execute`, dynamic `invoke`, event bus with `on`/`onAny`/`publish`, spans |
| `common/workflows/composition.ts`                                | The registry and plans ([command-composition.md](command-composition.md))                                 |
| `common/workflows/registration.ts`                               | `registerCommandHandler` (leaf commands), `commandTracing` (nested spans)                                 |
| `common/workflows/contracts.ts`                                  | `EntryKind`, `MutationInput`/`Result`/`Event`, `MutationCommands`, `AppEvents`                            |
| `src-db-server/workflows/kernel.ts`                              | Registry, runtime, `commit`, side effects, `publishAll`, action spans                                     |
| `src-db-server/workflows/execution.ts`                           | Builds the backend: kernel plus registrations, atomic boundary, `hydrate`                                 |
| `src-db-server/workflows/registerMutations.ts`                   | Mutation actions, the `mutation` boundary, mutation commands                                              |
| `src-db-server/workflows/registerStateful.ts`                    | Scheduler and vault boundaries and commands                                                               |
| `src-db-server/workflows/commandHandlers.ts`                     | Ordered actions per mutation command                                                                      |
| `src-db-server/workflows/commandActions.ts`                      | Action adapters over `src-db-server/domain/*` services                                                    |
| `src-db-server/workflows/{scheduler,vault}{Handlers,Actions}.ts` | Ordered actions and actions for scheduler and vault                                                       |
| `src-db-server/workflows/unitOfWork.ts`                          | The synchronous transaction and in-transaction repositories                                               |
| `src-db-server/workflows/domainBoundary.ts`                      | The extension atomic boundary                                                                             |
| `src-db-server/routes/events.ts`                                 | SSE forwarder: numbering, replay buffer, resync                                                           |
| `src/workflows/execution.ts`                                     | Builds the frontend: commands, queues, reactions, event intake, queries                                   |
| `src/workflows/commandTransport.ts`                              | One send path: expected events, readiness, HTTP, settlement, recovery                                     |
| `src/workflows/operations.ts`                                    | Tracks which expected events of an operation are handled                                                  |
| `src/workflows/eventStream.ts`                                   | SSE clients (`EventSource` in the webview, `fetch` under Bun)                                             |
| `src/workflows/reactionRegistry.ts`                              | Ordered reactions per event                                                                               |
| `src/workflows/reactions.ts`                                     | Reactions, and the query dependencies of scheduler and vault events                                       |
| `src/workflows/invalidation.ts`                                  | Batches each operation's refresh into one                                                                 |
| `src/workflows/queries.ts`                                       | Query coordinator: cache, dedupe, generations, invalidation                                               |
| `src/workflows/hooks.ts`, `schedulerHooks.ts`                    | React hooks over the coordinator and runtime                                                              |
| `src/workflows/tracking.ts`                                      | Local timer session and workflow warnings                                                                 |
| `src/workflows/commandRegistry.ts`, `services.ts`                | Verb-to-HTTP mapping and entity service instances                                                         |

## Backend: running a command

Entry: `backendRuntime.commands.execute(name, input, trace)`, called from a
route. The route never writes itself.

1. **Command span.** The runtime opens a `command` span. Its trace ID comes
   from the request headers, or from `input.operationId`.
2. **Boundary.** `registry.executeAsync` reaches the command's boundary.
   The **mutation boundary** then:
   - checks that the command family and verb match `input.kind` and
     `input.action`
   - strips resource `content`, which never travels in entity writes
   - picks the operation ID: `input.operationId`, else the trace ID, else
     a new UUID
3. **Transaction.** `kernel.commit` opens one synchronous transaction
   (`unitOfWork.transaction`) and runs the plan inside it. Actions receive
   an `ActionContext` with:
   - `announce(name, payload)`: queue an extra event, usually an announcement
     event
   - `compensate(undo)`: undo a file change if the transaction rolls back
   - `afterCommit(run)`: cleanup that integrity doesn't depend on
4. **On failure.** SQLite rolls back. Compensations run newest first, and a
   failing undo is logged. The span is marked `rolledBack`, queued events
   are dropped, and the error goes back to the route.
5. **Publish.** Announcements are published first, then the completion
   events:
   - `<family>.<verb>`, such as `entity.change`
   - `<kind>.<verb>`, such as `tasks.change`

   The payload is `MutationEvent`: the input plus `operationId` and
   `result`. Listener failures are logged per operation.

6. **After-commit effects** run in order. Failures are logged.
7. **Response.** The route calls `hydrate` to read the committed row back.
   If that read fails, the error is logged as "must not be retried".

Scheduler and vault boundaries follow the same steps with a carried `state`:

- Scheduler commands publish `schedulerCommandEvents[command]`.
- Vault commands publish `vault.changed`, or `resource.content.changed`
  with only the resource ID.

### Event names

| Event                                                 | Meaning                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `entity.*`, `entityCollection.*`, `entitySupporter.*` | Completion of a mutation command (family)                                            |
| `<kind>.add/change/delete/deleteAll`                  | The same completion, by kind                                                         |
| `<kind>.change` with `attachedIds` and no `result`    | Announcement: rows changed as a side effect (for example, members of a deleted area) |
| `scheduler.*`                                         | Scheduler completions                                                                |
| `vault.changed`, `resource.content.changed`           | Vault completions                                                                    |
| `tracking.changed`                                    | Frontend only: the local timer changed                                               |

Announcements share a channel with completions and are told apart by
payload. Keep that in mind when adding listeners.

### Event stream

`createEventForwarder` listens with `onAny`:

- It numbers every event and pushes it to connected `GET /events` clients
  as unnamed frames carrying `{ name, payload }`.
- It keeps the last 500 frames. A client that reconnects with
  `Last-Event-ID` gets what it missed.
- If the gap is no longer in the buffer, the client is sent `resync`.

## Frontend: sending a command

Entry: `runtime.commands.execute(name, input)`, used by store slices, hooks
and `taskCommands.ts`. Frontend commands are leaf handlers
(`registerCommandHandler`), so the registry gives them tracing and a single
dispatch path. Nested commands pass their parent trace.

### Queues

Writes that must not overlap are queued before they are sent:

| Writes                                                  | Queue                             |
| ------------------------------------------------------- | --------------------------------- |
| `task.transition`, task deletes, all scheduler commands | One lifecycle queue (`serialize`) |
| `resource.content.save`                                 | One queue per resource            |
| Other vault commands                                    | One shared vault queue            |
| Everything else                                         | Not queued                        |

`entity.change` on a task with a `status` change is rerouted to
`task.transition`. That keeps local tracking in step, while the backend
pauses competing work and stamps lifecycle times.

### `commandTransport.send`

1. Create an `operationId` and start tracking the expected events. For
   mutations these are `[<family>.<verb>, <kind>.<verb>]`. This happens
   **before** HTTP, because events can arrive before the response does.
2. Wait up to 1 s for the event stream to be ready, then send anyway.
3. Send HTTP with `x-operation-id`, `x-trace-id` and `x-parent-span-id`.
4. Wait up to 3 s for every expected event to be **handled** (received and
   all its reactions finished).
5. If they don't arrive in time:
   - record the `events.timeout` signal
   - run `recover`: refresh the command's query dependencies now
   - never resend the write
6. Return the HTTP result. A command's promise therefore resolves after
   mounted queries show the change.

### Receiving events

For each frame, `transport.connect` does the following:

1. Republish it on the local bus, with the trace of the local operation if
   there is one.
2. Mark it handled for settlement.

Events from other windows or processes take the same path. They simply
match no local operation.

`onResync` invalidates every kind and every non-entity dependency
(`schedule`, `occurrences`, `schedulerSettings`, `resourceContent`,
`vault`).

### Reactions

`reactionRegistry.ts` maps events to ordered reaction names. Reactions in
`reactions.ts` run one after another, each in a `reaction` span. A failing
reaction is logged and the next still runs.

| Reaction                | Runs on                                            | Does                                                                  |
| ----------------------- | -------------------------------------------------- | --------------------------------------------------------------------- |
| `invalidateDependents`  | Family completions                                 | Refreshes the kind's dependencies and ends the batch                  |
| `refreshAnnounced`      | `<kind>.change` announcements                      | Adds the kind to the operation's batch                                |
| `refreshSchedule`       | Scheduler events                                   | Refreshes `schedulerEventDependencies[event]`                         |
| `refreshVault`          | Vault events                                       | Refreshes `vaultEventDependencies[event]`                             |
| `syncTracking`          | `tasks.change`, scheduler mode/occurrence/tracking | Re-reads the tracked task; stops the timer if it is no longer running |
| `stopTrackingIfDeleted` | `tasks.delete`                                     | Stops the timer if its task was deleted                               |
| `stopTracking`          | `tasks.deleteAll`                                  | Stops the timer                                                       |

### Invalidation batching

One write can produce several announcements and then a completion.
`createInvalidationBatcher` collects their dependencies per operation and
refreshes once:

- A completion reaction (`complete = true`) flushes the batch at once.
- Otherwise the batch flushes after 25 ms, unless the operation is still
  pending locally.
- Dependencies already refreshed for an operation are skipped. This
  covers the last 500 operations, so replayed events don't refresh twice.

### Query coordinator

All reads go through `createQueryCoordinator` (`queries.ts`).

- Each query has a key (such as `list:tasks:1` or `detail:areas:<id>`), a
  `load` function, and the dependencies it reads. Dependencies are entry
  kinds plus `schedule`, `occurrences`, `schedulerSettings`,
  `resourceContent`, `vault` and `extensions`.
- Concurrent `ensure` calls share one request. Results are cached until
  invalidated.
- `invalidate(dependencies)` marks matching queries stale. It refetches
  only those that are mounted (`activate`).
- Every invalidation bumps the query's generation. A response that
  started earlier is thrown away, so it can never overwrite newer data.
- If a refresh after a write fails, `warnRefresh` shows "Your changes
  were saved, but ... could not be refreshed". Its **Retry** repeats only
  the read.

`dependencies(kind)` in `execution.ts` decides which kinds a kind's reads
depend on. For example, task reads also depend on tags, URLs and time
entries.

### Tracking

The running timer is a local presentation session:

- It is stored in `localStorage` under `active_tracking_task` and mirrored
  in the workflow UI store.
- The backend owns tracked time and task status.
- After any committed change that could affect the session,
  `syncTrackedTask` re-reads the task and clears the session if the task
  is no longer in progress.
- Every change to the session publishes `tracking.changed`.

## Telemetry

Both runtimes record spans with the same trace ID:

- Backend: `command`, `action`, `event`, `listener`, `http`.
- Frontend: `command`, `wait` (`stream.ready`, `events.settle`), `http`,
  `event`, `listener`, `reaction`, `query`.
- Frontend signals: `events.timeout`, `stream.resync`,
  `stream.reconnect`, `refresh.failed`.

Attributes hold IDs and counts only. See the README's
[Telemetry](../README.md#telemetry) section.

## Changing the runtime

| To add                       | Do                                                                                                                                                                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A backend integrity step     | Put the logic in a synchronous `src-db-server/domain/*` service. Add an adapter in `commandActions.ts` and a name in `CommandAction`. List it in `commandHandlers.ts` in the right position. The policy then enforces that order. |
| A scheduler or vault step    | Add the action in `schedulerActions.ts` or `vaultActions.ts`, and list it in the matching handlers file.                                                                                                                          |
| A new backend command family | Create a boundary that commits through `kernel.commit` and publishes through `publishAll` after commit. Register its definitions with a policy.                                                                                   |
| A frontend reaction          | Add it to `reactions.ts` and `ReactionName`, then list it under its events in `reactionRegistry.ts`.                                                                                                                              |
| A query dependency           | Add it to `QueryDependency`, map the events that change it (as in `schedulerEventDependencies`), and add it to the resync list.                                                                                                   |
| A frontend command           | Register it in `execution.ts` with `registerCommand`. Send writes through `commandTransport.send` with their expected events and a `recover`. Queue it if it must not overlap.                                                    |

Keep every action synchronous inside a transaction. Return a
`TransactionWorkUnit`, and use `compensate` for anything outside SQLite.

### Adding an entry kind

Entry kinds are listed in several places. Update each one that applies.

**Database and routes**

- Schema in `src-db-server/database/schemas/`, exported from `index.ts`, with
  junction tables for any relations. Then run `bunx drizzle-kit generate`
  (never edit generated migrations).
- Insert, select and update schemas in `database/validation.ts`.
- A repository implementing `IRepository` in `database/repositories/`, and the
  `tables` map in `repositories/readModels.ts`.
- A route file calling `routeGenerator`, added to `RouteGeneratorSchemas`,
  registered in `server.ts`.
- Foreign keys to collections use `onDelete: 'set null'` and go in
  `collectionMembers`, so deletions announce the affected rows.

**Workflow layer**

- `EntryKind`, `_kindHeads` and `commandHeadForKind` in
  `common/workflows/contracts.ts`.
- `entityTables` in `src-db-server/domain/entries.ts`.
- As relevant:
  - `supporterCapabilities` (`domain/supporters.ts`)
  - `supporterTables` (`domain/counts.ts`)
  - `collectionMembers` (`domain/collections.ts`)
  - `scheduleFields` (`domain/scheduleMaintenance.ts`), if the kind affects
    plans
  - the supporter kinds in `rowOutput` (`workflows/composition.ts`), if it
    is a supporter
- `allKinds` and `dependencies()` in `src/workflows/execution.ts`.
- The repository map in `src-db-server/extensions/queries.ts`.

**Frontend**

- `entityServices` and `fetchLimits` in `src/workflows/services.ts`.
- A slice in `src/store/slices/`, added to `src/store/index.ts`, and its
  reset in `common/testing/test-setup.ts`.
- List page: `entityRoutes` (`src/lib/entityRoutes.ts`), `entityRegistry`
  (`src/lib/entityActions/registry.ts`), `EntityPages.tsx` and the router.

## Tests

| Covers                                                                                            | File                                                                                   |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Runtime ownership, typed results, isolated listeners                                              | `common/__tests__/workflows.test.ts`                                                   |
| Traces across commands, events and listeners                                                      | `common/__tests__/telemetry.test.ts`                                                   |
| Rollback, publish after commit, kind events, counts, announcements, async rejection               | `src-db-server/__tests__/workflows.test.ts`                                            |
| Task integrity, competing work, exclusivity                                                       | `src-db-server/__tests__/domain.test.ts`                                               |
| Forwarder numbering, replay, resync, streaming                                                    | `src-db-server/__tests__/events.test.ts`                                               |
| Settling, lost events, never repeating a write, failed writes                                     | `src/__tests__/commandTransport.test.ts`                                               |
| Refresh after writes, other-window events, warnings and Retry, queues, tracking, resync, batching | `src/__tests__/workflows.test.ts`                                                      |
| Scheduler and resource flows                                                                      | `src/__tests__/schedulerWorkflows.test.ts`, `src/__tests__/resourcesWorkflows.test.ts` |
| SSE clients: ordering, reconnect, frame parsing                                                   | `src/__tests__/eventStream.test.ts`                                                    |
| Task lifecycle against the real server                                                            | `src/__tests__/taskLifecycle.test.ts`                                                  |
