# AGENTS.md

## Project Overview

`unHussle` is a local-first desktop productivity app that turns tasks, projects,
areas and goals into a daily plan and a single "next task". A Tauri (Rust) shell
wraps a React 19 + TypeScript frontend (Vite, served on port 1420) and spawns a
local Elysia/Bun REST API server (port 3456) as a sidecar. All data lives in a
local SQLite database accessed through Drizzle ORM. The app is fully offline.

`README.md` has the user guide and a longer walk-through of the data flow.

## Tech Stack

- Frontend: React 19, TypeScript ~5.8, React Router 7, Zustand, Tailwind CSS 4, Vite 7, shadcn/ui, TanStack Table
- Backend (sidecar): Elysia, Bun runtime, TypeBox validation (`drizzle-typebox`), Swagger
- Desktop: Tauri 2 (Rust)
- Database: SQLite 3 + Drizzle ORM (`drizzle-orm/bun-sqlite`)
- Dates: Temporal (`temporal-polyfill`) via `common/datetimeUtils.ts` / `calendarUtils.ts`
- Package manager: `bun`
- Tests: Bun test (`bun:test`) with preload `common/testing/test-setup.ts`

## Commands (bun)

| Script                                          | Purpose                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------- |
| `bun run dev`                                   | Build sidecar binary then start Vite dev server                           |
| `bun run debug`                                 | Vite only (no sidecar build)                                              |
| `bun run build`                                 | `tsc` then build sidecar then `vite build`                                |
| `bun run preview`                               | Vite preview                                                              |
| `bun run tauri`                                 | Tauri CLI (`bun run tauri dev` for the desktop app)                       |
| `bun run build:server`                          | Compile `src-db-server/build.ts` -> binary in `binaries/`                 |
| `bun run server`                                | Run API server against `.env.local` DB                                    |
| `bun run server:test`                           | Run API server against `.env.test` DB                                     |
| `bun run test`                                  | `scripts/test-with-server.sh` (starts test server, runs tests, cleans up) |
| `bun run lint` / `lint:fix`                     | ESLint / ESLint with auto-fix                                             |
| `bun run typecheck`                             | `tsc --noEmit`                                                            |
| `bunx drizzle-kit ...`                          | DB migrations (config in `drizzle.config.ts`)                             |
| `bunx --bun shadcn@latest add [component-name]` | Add new shadcn/ui component                                               |

Avoid `npm`/`yarn`/`pnpm`; lockfile is `bun.lock`.

## Repository Layout

```
src/                  React frontend
  pages/              HomePage (Next task + brain dump), PlannerPages (Day/Week/Preferences), EntityPages
  components/         ui/* (shadcn + ui/custom), app/*, pages/* (EntityListPage), dev/* (WorkflowInspector)
  lib/                router, entityRoutes, entityActions/ (per-kind actions + form registry),
                      inputParsers/ (brain dump), hooks/, server fetch
  services/           database/ configured CRUD service instances (HTTP clients), scheduler.ts (/scheduler client)
  store/              Zustand UI state; mutation command facades per kind + UI slice
  workflows/          frontend runtime: commands, SSE client, operations, reactions, queries, hooks, tracking, telemetry
  __tests__/          frontend/store tests
src-db-server/        Elysia sidecar API
  server.ts           app bootstrap (port 3456)
  database/           UnHussleDB (singleton), schemas/, repositories/ (hydrated reads), validation, seed/
  routes/             routeGenerator-based CRUD routes, scheduler.ts, events.ts (SSE), telemetry.ts
  workflows/          backend runtime: command + scheduler registries, action adapters, unit of work,
                      private execution contracts, scheduler reads
  domain/             task validation/lifecycle, tracking, collection integrity, supporters,
                      counts, resource links/files, vault operations, schedule maintenance
common/               Shared code for both sides
  workflows/          createRuntime, contracts, telemetry
  scheduler/          planning engine: contracts, preparation, engine, rules, ruleRegistry, anchors, validation, status
  types/              row types, hydrated shapes, enums (ProgressStatus, Priority, AnchorType)
  Logger.ts, datetimeUtils.ts, calendarUtils.ts, taskSchedule.ts, version.ts, testing/
src-tauri/            Rust Tauri shell (sidecar lifecycle)
drizzle_migrations/   SQL migrations (bundled as Tauri resource)
drizzle.config.ts
```

## Path Aliases

Defined in `tsconfig.json` and `vite.config.ts`:

- `@/*` -> `src/*`
- `@d/*` -> `src-db-server/*`
- `@c/*` -> `common/*`

Both frontend and sidecar share these aliases.

## Architecture Notes

- Tauri (`src-tauri/src/lib.rs`) spawns `binaries/db-server-<triple>` with
  `DB_FILE_URL` (`<AppData>/db/ecn.unhussle.sqlite`), `DB_MIGRATIONS_DIR`
  (`resources/drizzle_migrations`) and `VAULT_DIR` (`<AppData>/vault`). On exit
  it sends SIGTERM, then kills. Plugins: shell, opener (with an
  `opener:allow-open-path` scope for `$HOME` and mount points, used by
  `openPath`) and dialog (file/folder pickers; added with `bun tauri add dialog`).
- Frontend talks to `http://localhost:${VITE_DB_SERVER_PORT}` (default 3456).
- `server.ts`: `httpTracing`, a gzip `mapResponse` (skips `/api`, raw
  `Response`s and `undefined`), Swagger at `/api`, CORS, `/health`, entity
  routes, `/scheduler`, `/vault`, `/events`, `/telemetry`. Elysia calls
  `mapResponse` after every error hook: it must skip `undefined` (or the first
  hook that answers nothing ends error handling) and send a `status(code, body)`
  under its code. The app-level `onError` only answers validation errors, so
  the routes' own hooks set 404 / 409 / 400. The seed runs on start when `areas` and `goals` are
  both empty.
- `UnHussleDB` is a singleton. `getDb()` opens SQLite (foreign keys, WAL),
  runs migrations, and marks the DB ready. There are no prepared statements.
  Reads go through `database/repositories/*`.
- **Read projections** (`database/repositories/*`): list/search reads fetch scalar
  rows with the direct tags and reference labels needed by their tables. Task
  tables include only open tracking intervals; `getById` remains the flat edit
  read with direct attachments and full own interval history. Junctions are
  unwrapped with the shared helpers. Collection rows never contain task arrays.
  `withCollectionTotals` computes read-only `resolved_task_total` in one batched
  count query; `count_tasks` remains direct-only.
- **Detail reads** (`repositories/readModels.ts`): `GET /:kind/:id/detail` for
  projects, goals, areas, tags and URLs returns `{ item, directRelations, tasks:
  { items, total, nextCursor } }`. Membership comes from `taskMembership.ts`,
  then SQL filters/orders/limits IDs before fetching task table projections in
  batches. Task cursors are scoped to container, filters and ordering. The
  default page is 20, maximum 100. Related panels use these server pages.
  `SupporterItemsRepository` also serves this shape at `/tags/:id/items` and
  `/urls/:id/items`. Direct relations never acquire descendant attachments;
  resource backlinks do not discover tasks. Upward task context stays separate.
- **References**: `GET /:kind/references` returns `{ items, total, nextCursor }`
  with id/title, collection icon/color and direct tag labels. Supports `q`,
  comma-separated `ids`, `cursor`, and `limit` (maximum 100). Selectors,
  autocomplete and brain dump use reference queries; badges render supplied
  labels rather than consulting paginated store lists. Plain select inputs
  follow reference continuations while mounted. Resource content stays outside
  every entity/detail/reference projection.
- `routeGenerator` (`src-db-server/routes/routegenerator.ts`) provides
  `GET /`, `GET /paginated/:page/:pageSize`, `GET /:id`, `GET /search/:term`
  plus `/references` and `/:id/detail` reads
  (leading `#` stripped, limit `VITE_SEARCH_RESULTS_COUNT`), `POST /`,
  `PATCH /:id`, `DELETE /:id` and `DELETE /all` (`{ deleted: n }`). Extra routes
  are chained onto the generated plugin (e.g. `GET /tags/:id/items` and `/urls/:id/items`,
  `GET|PUT /resources/:id/content`, `GET /tasks/:id/context`). Errors: `NOT_FOUND`
  → 404, unique-title conflicts → 409, `VaultConflict` → 409, `VaultError` → 400.
- Mutating routes do not write directly: they execute backend commands
  (`${commandHeadForKind[kind]}.add|change|delete|deleteAll`) on `backendRuntime`,
  then return the row re-read through the repository (`backendRuntime.hydrate`).
- **Time tracking** is backend-owned. Task status transitions
  (`trackTaskInterval`) and occurrence transitions (`trackOccurrenceInterval`)
  open and close `time_entries` and add minutes to `tasks.spent_minutes` /
  `task_occurrences.spent_minutes`. Starting one task closes every other open
  interval and pauses its task. `scheduler.tracking.stop` closes an open interval at a
  user-given time (`pauseInterval`), for work left running since an earlier
  day. The UI asks instead of counting the night: the home card inline
  (`runningSinceEarlierDay`, `OvernightCheck`), and the Tasks page before
  Pause/Complete/Cancel (`overnightStart` in `useTaskActions` →
  `askOvernight` → `OvernightDialogHost`). "Still on it" is remembered per
  interval (`overnightKey`). The frontend only keeps the active session
  (`taskId`, `startTime`) in
  localStorage for the UI timer, and clears it after a one-off `scheduler.tracking.stop`.
- Paused one-off tasks stay eligible on later days. Past-day appointments
  that weren't done stop being candidates (by design: missed is missed).
- **Vault** (`src-db-server/vault/vault.ts`). Each resource is a markdown file;
  the DB row is its index (`file_path`, relative to the vault, and
  `content_hash`). The root is `app_settings.vaultDir` (user's choice), else
  `VAULT_DIR`, else `vault/` next to the DB file (a temp folder for `:memory:`).
  The file name is `slugify(title)` (`common/slug.ts`), numbered on collision;
  renaming the title moves the file within its folder. Deleting moves it to
  `.trash/`. There is no watcher: content is read from disk on every open,
  `missing` flags rows whose file is gone, and `vault.rescan` imports new
  files (title from the first `# heading`) and relinks renamed ones.
  - File changes run synchronously inside the command's transaction and
    register an undo with `ActionContext.compensate`; undos run newest first on
    rollback. `afterCommit` is for cleanup integrity doesn't need (removing the
    old vault after a move); its failures are only logged.
  - **Content never travels through `entity.*`**: it would land in
    `MutationEvent`s, SSE frames, the replay buffer and debug logs. It's saved
    with `resource.content.save` (events carry only `{ operationId, id }`) and
    read with `GET /resources/:id/content`, never in hydrated rows. Saves send
    the `baseHash` they read; a different file on disk is a `VaultConflict`
    unless `force`.
- **Task context** (`repositories/taskContext.ts`, `GET /tasks/:id/context`):
  a task's own resources, URLs and tags, plus those it inherits, grouped by
  ancestor (project → goals → areas, the same chain as `workPredicate` in
  `repositories/scheduler.ts`; keep them in step). Each item shows once, under
  the nearest owner. Inherited items are read-only and never copied onto the task.
- Logging via `common/Logger.ts` (`Logger.getInstance()`), not `console`.

## Data Model

| Family      | Kinds / tables                                                                              | Notes                                                                                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entities    | `tasks`, `resources`                                                                        | Tasks: `project_id` / `area_id` / `goal_id` (`set null`), `anchor_id`/`anchor_type`/`anchor_slot`, recurrence, flags, schedule. Resources: no FKs; `file_path`, `content_hash`, own tags.                               |
| Links       | `junction_resources`                                                                        | Many-to-many: `attachedToId` = task / project / area / goal (no FK), `refId` = resource (cascade). Owners send `resources: [{id}]`, a resource sends `links: [{kind,id}]`; collections count them in `count_resources`. |
| App         | `app_settings`                                                                              | One `default` row: `{ vaultDir? }`.                                                                                                                                                                                     |
| Collections | `projects`, `areas`, `goals`                                                                | Projects → area, goal. Goals → area. Derived `count_tasks` / `count_resources`.                                                                                                                                         |
| Supporters  | `tags`, `urls`, `time_entries`                                                              | Junctions `junction_*`: `attachedToId` = owner (no FK), `refId` = supporter. Derived `count_tasks` / `count_resources` / `count_pga`.                                                                                   |
| Scheduler   | `day_plans`, `plan_items`, `task_occurrences`, `scheduling_overrides`, `scheduler_settings` | Plan id `${timezone}:${date}` with `revision`, `stale` and the day mode (`breakStartedAt`, `wrapReason`, `autoWrap`). Occurrence id `${taskId}:${date}:${slot}`. Overrides hold deferrals. One `default` settings row.  |

## Workflows (commands → actions → events → reactions)

Both sides use `createRuntime` (`common/workflows/runtime.ts`): typed commands with one handler each, plus events with any number of listeners (`on`, `onAny`).
Handlers and listeners receive `(name, payload, context, trace?)`. `publish`
uses `Promise.allSettled`, so a failing listener never throws into the
publisher. Shared types are in `common/workflows/contracts.ts` (mutations) and
`common/scheduler/contracts.ts` (scheduler). Backend action, transaction and
publication types live in `src-db-server/workflows/contracts.ts`. Runtime enums
come from `common/types/enums.ts`; schema-derived imports must be type-only.

Command families come from `commandHeadForKind`:

| Family             | Kinds                          |
| ------------------ | ------------------------------ |
| `entity`           | `tasks`, `resources`           |
| `entityCollection` | `projects`, `areas`, `goals`   |
| `entitySupporter`  | `tags`, `urls`, `time_entries` |

Each family has the verbs `add`, `change`, `delete` and `deleteAll`. `entry.*` is
the backend-internal base that the families nest.

Scheduler commands (`SchedulerCommands`) and the event each one publishes:

| Command                           | Route                           | Event                          |
| --------------------------------- | ------------------------------- | ------------------------------ |
| `scheduler.generate`              | `POST /scheduler/generate`      | `scheduler.changed`            |
| `scheduler.replan`                | `POST /scheduler/replan`        | `scheduler.changed`            |
| `scheduler.adjust`                | `POST /scheduler/adjust`        | `scheduler.changed`            |
| `scheduler.mode.change`           | `POST /scheduler/mode`          | `scheduler.mode.changed`       |
| `scheduler.settings.change`       | `PATCH /scheduler/settings`     | `scheduler.settings.changed`   |
| `scheduler.occurrence.transition` | `POST /scheduler/occurrence`    | `scheduler.occurrence.changed` |
| `scheduler.tracking.stop`         | `POST /scheduler/tracking/stop` | `scheduler.tracking.stopped`   |

Scheduler reads, which never write: `GET /scheduler/settings`,
`/day/:date`, `/next/:date` and `/week/:date` (with `?timezone=`).

Vault commands (`VaultCommands`, `common/vault/contracts.ts`; `vaultHandlers.ts`
→ `vaultActions.ts` adapters over `domain/vault.ts` and one backend `VaultState`,
like the scheduler):

| Command                 | Route                        | Event                      | Actions                                                |
| ----------------------- | ---------------------------- | -------------------------- | ------------------------------------------------------ |
| `resource.content.save` | `PUT /resources/:id/content` | `resource.content.changed` | `loadResource`, `checkContentBase`, `writeContent`     |
| `vault.rescan`          | `POST /vault/rescan`         | `vault.changed`            | `listVaultFiles`, `repairMissing`, `importUnindexed`   |
| `vault.settings.change` | `PATCH /vault`               | `vault.changed`            | `validateVaultTarget`, `copyVault`, `saveVaultSetting` |

`GET /vault` reads the folder, its source and resource / missing counts.

**Backend** (`src-db-server/workflows/`)

- `commandHandlers.ts` maps each mutation command to an ordered list of action names.
  `handler:<command>` inlines another command's list, and cycles are rejected.
  Current lists, after the inlined `entry.*` row action:
  - `entity.add|change`: `validateTask`, `trackTaskInterval`,
    `updateSupporters`, `updateResourceLinks`, `syncResourceFile`,
    `updateSupporterCounts`, `updateCollectionCounts`, `markPlansStale`, plus
    `syncPlanMembership` on change.
  - `entity.delete|deleteAll`: `announceResourceLinks` and `trashResourceFiles`
    **before** the row delete, then `deleteJunctions`, both counts,
    `markPlansStale`, `syncPlanMembership`.
  - `entityCollection.*`: supporters, `updateResourceLinks`, supporter and
    collection counts on add/change. `announceAffectedEntities` on change, and
    (with `announceResourceLinks`) **before** the row delete on
    delete/deleteAll. `markPlansStale` except on add.
  - `updateResourceLinks` replaces links from either side and announces the
    other side (`<kind>.change` with `attachedIds`). Task-, resource- and
    file-only actions return early for other kinds.
  - `entitySupporter.*`: `deleteJunctions` on delete, and `markPlansStale`,
    which only reacts to tags.
- `commandActions.ts` holds the named actions. An action
  `(name, input, ActionContext)` returns a **synchronous** `TransactionWorkUnit`.
  All of a command's units run in one transaction (`unitOfWork.ts`); an error
  rolls the whole command back. Actions delegate integrity work to `domain/`.
  `entry.*` handlers are internal expansion templates and cannot be executed
  directly; public mutation families must match `commandHeadForKind[kind]`.
- Actions are built one at a time, and `carryForward` feeds each result into the
  next action's input:
  - a created or updated row sets `id`;
  - deleted rows set `attachedIds` (entities/collections, junction `attachedToId`)
    or `ids` (supporters, junction `refId`).
- The command result is the last non-undefined result. Bulk actions return the
  rows themselves.
- `validateTask` runs after the write, on the stored row: recurrence rule,
  `scheduled_end > scheduled_start` (`common/taskSchedule.ts`), and anchors
  (`validateTaskAnchors`).
- `toRowValues` strips supporter and link keys (`tags`/`urls`/`time_entries`/
  `resources`/`links`), derived counts and vault-owned columns (`file_path`,
  `content_hash`, `content`, `missing`). When a task's `status` changes it also strips `spent_minutes`,
  `started_at` and `completed_at`, which `trackTaskInterval` owns. It sets URL
  `parts` and normalizes tag titles (`normalizeTagTitle`), as every write path does.
- Derived counts (`count_tasks`, `count_resources`, `count_pga`) are recalculated
  in `domain/counts.ts` and are never client-writable.
- `domain/scheduleMaintenance.ts`: `affectsSchedules` decides from the kind and changed
  fields (`scheduleFields`) whether `markPlansStale` flags current and future
  plans. `syncPlanMembership` makes saved one-off rows follow their task's
  status, cancels or removes occurrences the task no longer produces, and bumps
  plan revisions.
- **Scheduler commands** (`schedulerHandlers.ts` → `schedulerActions.ts`) run
  their action names in order over one mutable `SchedulerState`, inside one
  transaction. An action may set `state.done` to finish early (`keepSaved`
  makes `generate` idempotent). Day commands start with
  `expireOccurrences → loadPlan → checkRevision`. A mismatched `revision`
  throws `ScheduleConflict`, which the route turns into 409. Other plan errors
  return 400 with a user-facing message.
- **Day mode** (`scheduler.mode.change`: `loadDay → changeMode → pauseForBreak
→ buildPlan → savePlan`). `changeMode` sets `state.mode`, and `savePlan`
  stores it (otherwise the previous plan's mode is kept). Repeated changes are
  no-ops (`state.done`).
  - `startBreak` sets `breakStartedAt`, then `pauseOpenWork` closes every open
    interval and pauses its task/occurrence. It re-plans with cue `break`.
  - `endBreak` clears it and keeps the stack (`state.plan = previous`, so
    `buildPlan` skips).
  - `startWrap` sets `wrapReason` and re-plans with cue `wrap`. A non-`manual`
    reason is ignored on a break or when `autoWrap` is false.
  - While `wrapReason` is set, `buildPlan` uses `wrap` for every cue except
    `more`. `more` clears `wrapReason` and sets `autoWrap = false` for the day.
- `workflows/scheduler.ts` holds the reads: `composeDay` (fresh stack from DB
  state), `readDay` (saved order + live task/occurrence/tracking data),
  `previewWeek` (allocates each one-off to at most one day), `readNext`.
  Unsaved days within the week follow the preview, so saving keeps the allocation.
- After commit, the runtime publishes queued `ActionContext.announce(...)`
  events before the family (`entity.add`) and kind (`tasks.add`) completion
  events. Scheduler tracking changes also announce affected tasks before their
  completion event, so clients settle after dependent rows refresh. Queued events are dropped on rollback. All
  mutation payloads are `MutationEvent` and carry `operationId`: the client's
  `x-operation-id` header, or a generated id. Scheduler events are
  `{ operationId, date? }`.
- `announceAffectedEntities` publishes `<kind>.change` with `attachedIds` and no
  `result` for the members of a collection. It must run **before** a collection
  delete, because members' foreign keys are `set null` afterwards.
- `routes/events.ts` sends every event to `GET /events` (SSE): numbered,
  unnamed frames whose data is `{ name, payload }` (an `EventSource` only
  dispatches named events to per-name listeners), a 500-frame replay buffer for
  `Last-Event-ID` (header, or `?lastEventId=`), and `resync` when the gap can't be
  covered. The handler calls `server.timeout(request, 0)` so a quiet stream isn't
  closed as idle (Elysia's default is 30s). `serve` options set on a plugin are
  ignored, so don't rely on them. There is no heartbeat: the client is local, so
  closing either side closes the socket. The gzip `mapResponse` in `server.ts`
  skips raw `Response`s; keep it that way.

**Common scheduler** (`common/scheduler/`, pure, used by both sides)

- `preparation.ts`: `expandCandidates` turns tasks into `PlanEntry`s (one per
  one-off, one per recurring slot). It works out remaining minutes, fixed
  start/end, slot windows and the priority tuple (task, project, goal, area).
  `occursOn` mirrors the repository's SQL eligibility.
- `engine.ts`: `buildDay` owns every hard constraint (day window from
  wake/now to sleep, appointments, windows, anchor groups, capacity, daily
  work limit for `workTags`) and runs the cue's rules in order. Cues `wrap` and
  `more` may plan past wind-down, until midnight (`dayWindow`'s
  `pastWindDown`). `nextTask(plan, now, skipped)` picks the home card's item,
  passing over the set of skipped entries.
- `dayMode.ts`: `dayModeOf` (break wins over wrap), `windDownOf`, and
  `wrapUpReason(plan, now)`. It returns `windDown` within
  `settings.wrapMinutes` before wind-down (never after it), or `lastTask` when
  the only pending flexible non-chore entry is in progress with
  ≤ `wrapMinutes` left. It returns nothing for unsaved, non-today, break,
  wrapping or `!autoWrap` plans.
- `rules.ts`: preferences only. Pickers (`keepActive`, `preScheduled`,
  `recurringOccurrences`, `urgentCandidates`, `resumePaused`, `dueSoon`,
  `priorityRanking`, `dueDateRanking`, `oldestFirst`, `wrapChores`) call
  `pick`. `resumePaused` takes paused one-offs (not occurrences, which are
  per-day and expire as `missed`); it is not required. Arrangers
  (`starterTask`, `easyReturn`, `quickOrFunBetweenLong`,
  `choresLast`, `restorePins`) call `move`, which is refused if it would break
  an anchor. `keepActive` also keeps pinned entries.
- `ruleRegistry.ts`: an ordered rule list per cue:
  - `fresh`: starter first;
  - `break`: `easyReturn` first;
  - `wrap`: `keepActive`, `preScheduled`, `wrapChores`, `restorePins`;
  - `more`.

  `settings.rules[cue]` replaces a cue's list. Rules are ordered user
  preferences, and recurring ≠ habit.

- `anchors.ts`: anchor resolution, groups, violations. `AnchorType` is
  `before` / `after` (adjacent) or `any_before` / `any_after`.

**Frontend** (`src/workflows/`)

- The query coordinator owns all server-derived data. Zustand owns UI state,
  mutation loading/errors and local session presentation; entity slices expose
  mutation commands without row arrays or synchronous getters.
- `commandTransport.ts` shares operation registration, readiness, HTTP tracing,
  settlement, timeout invalidation and cleanup for CRUD, scheduler and vault.
  Expected events are registered before the request. The existing lifecycle
  queue and per-resource vault queues remain outside transport. All API clients
  use `lib/apiAddress.ts` with the port `3456` default.
- Frontend commands (`FrontendCommands` in `src/workflows/contracts.ts`): the
  three mutation families (`commandRegistry.ts` maps verbs to `EntryTransport`
  calls), the scheduler commands (`services/scheduler.ts`), plus:
  - `task.transition`: a `entity.change` on tasks with a `status` is routed
    here. It sends one backend mutation, updates local session presentation
    after commit, and publishes `tracking.changed`. Backend domain services
    close competing intervals and pause work atomically; the UI never sends
    a preliminary pause.
    `taskCommands.ts` wraps it (`startTask`, `pauseTask`, …).
  - `brainDump.submit`: creates the task, putting it in the "Brain Dump" area
    when it has no collection, or creates standalone URLs. It returns the URLs
    that failed, so a retry doesn't repeat the writes that succeeded.
  - `task.transition`, task deletes and all scheduler commands are serialized
    on one queue. Occurrence and break starts coordinate tracking in the
    backend transaction. `syncTracking` reconciles local sessions from committed
    task/scheduler events; failed timer reads offer a read-only retry.
- Vault commands go through `services/vault.ts` (`options.vault` in tests).
  They wait for their event like scheduler commands; saves of one resource are
  queued one at a time. `resource.content.changed` and `vault.changed` →
  `refreshVault` (`vaultEventDependencies`). Autosave (`lib/resourceAutosave.ts`,
  `useResourceAutosave`) debounces 1s, keeps one save in flight, stops on a
  409 until Reload / Keep mine, and flushes before navigation.
- Frontend-only events (`tracking.changed`) are declared in
  `src/workflows/contracts.ts`.
- `eventStream.ts` has two SSE clients; `createEventTransport` picks one. The
  webview uses `EventSource`: WebKitGTK (Tauri on Linux) holds back the end of a
  streamed `fetch` body until more bytes arrive, so the last frame of each burst
  would wait for the next action and every command hit its 3s timeout. Bun has
  no `EventSource`, so store tests under `bun test` use the `fetch` client. Both
  handle frames one at a time, reconnect with the last id (an `EventSource`
  that gave up is reopened with `?lastEventId=`), and resync when they have no id. Tests inject a fake `EventTransport`. On `resync` the runtime
  invalidates every kind plus `schedule`, `occurrences` and `schedulerSettings`.
- `reactionRegistry.ts` maps events to reaction names; `reactions.ts` implements
  them:
  - family events → `invalidateDependents`, which flushes the union of
    dependencies accumulated for the operation by `invalidation.ts`;
  - `tasks.delete` → `stopTrackingIfDeleted`, `tasks.deleteAll` → `stopTracking`;
  - `tasks|resources|projects|goals.change` → `refreshAnnounced` (only
    announcements: `attachedIds` and no `result`; queues query dependencies);
  - `scheduler.changed`, `scheduler.mode.changed`,
    `scheduler.settings.changed`, `scheduler.occurrence.changed` → `refreshSchedule`
    (invalidates `schedulerEventDependencies[event]`; mode changes also refresh
    tasks, occurrences and time entries, since a break pauses work).
  - Put generic query invalidation on family completion events, so each
    affected query refreshes once per operation. Put kind-specific behaviour on kind events.
- Reads go through the query coordinator (`queries.ts`, `useWorkflowQuery`):
  - keys look like `list:<kind>:<page>`, `detail:<kind>:<id>`,
    `search:<kind>:<term>`, `related:<kind>:<id>:<options>`, `references:<kind>`,
    `schedule:day:<tz>:<date>`, `schedule:week:<tz>:<date>`, `schedule:settings`,
    `content:resources:<id>` (refetched on every mount), `context:tasks:<id>`,
    `vault:info`. Each one declares `dependencies` (`EntryKind` or `schedule` /
    `occurrences` / `schedulerSettings` / `resourceContent` / `vault`). `dependencies(kind)` in `runtime.ts`
    gives the standard set for a kind;
  - requests are deduplicated and empty results are cached;
  - an obsolete response can never overwrite a newer one (generations);
  - each result belongs only to its query; pages, searches, details and
    related queries never project rows into Zustand or change other membership;
  - invalidation refetches only active (mounted) queries; others are marked stale;
  - related panels subscribe only while mounted.
- `schedulerHooks.ts`: `useTodayPlan` generates and saves today's plan once per
  date if it isn't saved, and re-reads at the next time boundary. It sends
  `startWrap` once per date and reason when `wrapUpReason` fires.
  `useSkippedTasks(date)` keeps "Do something else" skips in localStorage per
  day; re-plans clear them. Other hooks are `useDayPlan` (refreshes on window
  focus), `useSchedulerClock` and `useSchedulerAction`. The home card calls
  `nextTask` locally on the saved plan. On a break it shows only a calm break
  view with an optional peek (no timer, by design). While wrapping up it shows
  a banner with the reason and **Pull more tasks**.
- A refresh that fails after a committed write shows a warning
  (`WorkflowWarnings`). Its Retry repeats only the read, never the write.
- There is one frontend runtime per store (`getFrontendRuntime`, keyed by
  `getState`). Dispose runtimes and queries on teardown and hot reload
  (`disposeFrontendRuntimes`).

Rules for both sides:

- Required integrity work belongs in commands/actions, not in event listeners
  or reactions. A failing listener or reaction never fails a committed write.
- Events are not durable and writes are never retried automatically.
- Scheduling hard constraints live in `engine.ts`; rules only express preference.

**Telemetry** (`common/workflows/telemetry.ts`)

- `createRuntime(context, { telemetry })` records a span per command, event and
  listener. Handlers and listeners receive their span as a 4th argument
  (`trace`). A nested command passes `{ traceId: trace.traceId, parentId:
trace.spanId }` as `execute`'s 3rd argument. Pass the same to `publish`.
  There is no AsyncLocalStorage, because the webview doesn't have it.
- The backend adds `action` spans (in the transaction, so they're synchronous;
  scheduler actions too) and `http` spans (`routes/telemetry.ts`; `/events`,
  `/telemetry` and `/api` are untraced). It marks a failed command
  `rolledBack`. The frontend adds `reaction`, `http`, `wait` and `query` spans,
  plus signals: `events.timeout`, `stream.resync`, `stream.reconnect`,
  `refresh.failed`. Uncaught errors and render errors become `error` spans
  (`captureGlobalErrors`, `AppErrorBoundary`).
- Trace id: the frontend root command's trace. It goes to the backend as
  `x-trace-id` / `x-parent-span-id`. `operationId` stays unique per request
  and is mapped back to the trace when its events arrive. Backend-only commands
  use the `operationId`.
- `GET /telemetry?traceId=&kind=&status=&since=&limit=` returns the backend ring
  buffer (2 000 spans). The sidecar also appends JSONL to `telemetry.jsonl`
  next to the DB file (batched, rotated at 5 MB; disabled for `:memory:` and
  `NODE_ENV=test`). The dev-only inspector (`Ctrl+Shift+O`,
  `src/components/dev/WorkflowInspector.tsx`) merges both halves.
- Rules: attrs hold ids and counts, never payloads (user data). Payloads are
  logged only at debug level. Sinks and subscribers never throw into the
  workflow. Telemetry is never published on `AppEvents`, since it would recurse
  and flood the SSE replay buffer. Log errors with
  `logger.error(message, { error, traceId })`, not `String(error)`.

Extending:

- Backend: add an action to `commandActions.ts` (and `CommandAction` in
  `src-db-server/workflows/contracts.ts`), then list it in `commandHandlers.ts`. Scheduler: add to
  `schedulerActions.ts` (and `SchedulerActionName`), then list it in
  `schedulerHandlers.ts`.
- Frontend: add a reaction to `reactions.ts` (and `ReactionName`), then list it
  under an event in `reactionRegistry.ts`.
- Planning preference: add a rule to `common/scheduler/rules.ts` (and
  `planRuleNames`), then place it in the cue lists in `ruleRegistry.ts`.
- New scheduler command: add it to `SchedulerCommands` and
  `schedulerCommandEvents`, a route in `routes/scheduler.ts`, a path in
  `services/scheduler.ts`, and its event's reads in `schedulerEventDependencies`.
- The direction is to let extensions register their own actions, reactions and
  rules by merging into these registries.

## Frontend UI

- Routes (`src/lib/router.ts`): `/` (NextTaskCard + BrainDumpInput), `/day`,
  `/week`, `/scheduler/settings` (with the vault card), list pages `/projects`,
  `/areas`, `/goals`, `/tasks`, `/urls`, `/tags`, `/resources` (`entityRoutes`),
  and the lazy-loaded MDXEditor page `/resources/:id`
  (`getEntityItemRoute('resources', id)` goes there). List pages take
  `?id=` (selection), `?q=` (search), `?related=` and column filters as query params.
- `EntityListPage` is configured per kind in `pages/EntityPages.tsx` (columns,
  filters, actions, related panel). `lib/entityActions/registry.ts` holds each
  kind's label, mutation facade, field builder, separate creation/edit defaults
  and `transformValues` (tasks use `resolveTaskSchedule`). `CreateEntityButton`
  and `EntityEditDialogHost` share `useEntityFields` and `useEntitySubmission`.
  Dialogs mount selectors only while needed; local drafts survive background
  query refreshes. Forms submit configured direct editable fields only.
- Brain dump parsing (`lib/inputParsers/`): `#hashtag` matches a project, area
  or goal by title (underscores = spaces) or by one of its tags, otherwise it
  becomes a tag. URLs are `http(s)://`, `file://` and `www.`. The estimate is
  `est:` / `et:` (`1h 30m`), and the due date is `due …` at the end.
- File URLs (`lib/fileUrls.ts`): `PickPathButtons` (Tauri only) fill a
  `file://` URL from the dialog plugin; `openLink` opens files with the
  default app (`openPath`) and other URLs in the browser; `revealLink` shows a
  file in its folder. The webview has no `Bun.fileURLToPath`, so the converters
  use `URL` and are tested against Bun's.
- Forms: `resources` (tasks and collections) and `resourceLinks` (resources)
  field types use `EntityRefsInput`. NextTaskCard's `TaskContextSheet` lists
  the task's own and inherited resources, URLs and tags.

## Database & Migrations

- Schemas: `src-db-server/database/schemas/*.ts` (Drizzle). Validation: `validation.ts` (TypeBox schemas generated via `drizzle-typebox`, plus scheduler request/response schemas).
- Migrations output: `./drizzle_migrations` (config in `drizzle.config.ts`).
- Tauri bundles `drizzle_migrations/` as resource; runtime path via `DB_MIGRATIONS_DIR`.
- DB file path via `DB_FILE_URL` (`.env.local` / `.env.test`; defaults to `./db/ecn.unhussle.sqlite`).

Generate migration:

```
bunx drizzle-kit generate
```

Apply happens automatically on server startup via `migrate()`.

## Code Style

- Prettier: single quotes, no semicolons, trailing commas `all` (`.prettierrc`).
- TypeScript strict mode; `noUnusedLocals`, `noUnusedParameters`.
- ESLint can be run by calling `bun run lint`.
- Format on write is handled by harness hooks when enabled.
- Use path aliases instead of relative deep imports where practical.
- Shared types live in `common/types`; import runtime enums from `common/types/enums`
  and schema-derived types with `import type` to avoid runtime schema cycles.
- `common` also has some additional utils (Logger, datetimeUtils, calendarUtils, taskSchedule). Use these instead of ad-hoc implementations.
- This project uses shadcn/ui for UI components. New components as needed can be added using `bunx --bun shadcn@latest add [component-name]`.
- UI Components are available under `src/components/ui` (shadcn), `src/components/ui/custom` and `src/components/app` (app-specific). Use these as much as possible instead of creating ad-hoc components like <input/>, <button/> etc.

## Testing

- Tests live in `__tests__` folders and `*.test.ts` / `*.spec.ts`
  (`common/__tests__`, `src-db-server/__tests__`, `src/__tests__`).
- Bun preload (`common/testing/test-setup.ts`) resets DB state in `afterAll` via Zustand store
  (through the frontend runtime, so it needs the test server and its event stream),
  then disposes the frontend runtimes.
- The seed (areas, goals and their tags) only runs when both `areas` and `goals` are empty.
  Don't partially delete test DB data by hand: it can leave seeded tags missing for the next run.
- Backend workflow tests use `new UnHussleDB(':memory:')` + `createBackendRuntime(db)`
  (`createBackendRuntime` accepts `{ telemetry, now }`; scheduler routes accept `now` too).
  Frontend workflow tests use fake services that emit backend-shaped events through a fake
  `EventTransport` (see `src/__tests__/workflows.test.ts`, `schedulerWorkflows.test.ts`).
  `createFrontendRuntime` accepts `services`, `scheduler`, `transport`, `storage`, `now`,
  `eventTimeoutMs`, `readyTimeoutMs` and `telemetry`.
- Always start the test server first (`bun run server:test` or use `bun run test`).
- Coverage enabled by default (`bunfig.toml`); `*.schema.ts` excluded.
- Do not commit test DB contents; `db` and `db_test` are gitignored.

## Environment / Secrets

- `.env.local`, `.env.test` are gitignored; `.env.template` documents vars.
- `.agentic/` is gitignored (local tooling state).
- Never read/commit `.env.*` secrets. Vars: `VITE_LOG_LEVEL`, `NODE_ENV`, `DB_FILE_URL`,
  `DB_MIGRATIONS_DIR`, `VAULT_DIR`, `VITE_DB_SERVER_PORT` (API port for both server and frontend; default 3456),
  `DB_SERVER_BUILD_DIR`, `VITE_SEARCH_RESULTS_COUNT`, `VITE_FETCH_LIMIT_<KIND>` (list page sizes, `src/workflows/services.ts`).
- Rust sidecar settings via `src-tauri/.env.x11` / `.env.wayland`.

## Conventions for Changes

- Keep changes consistent with generic CRUD route pattern; prefer editing `routeGenerator`.
- Mutations go through workflow commands, never direct writes in routes or direct store
  patches in frontend commands. New side effects become actions (backend) or reactions (frontend).
- Add new entities: schema in `src-db-server/database/schemas` (export from `index.ts`),
  validation entry, junction tables if relations, a repository in `database/repositories`
  (implementing `IRepository`), route file via `routeGenerator` (and its `RouteGeneratorSchemas`
  union), register in `server.ts`, service in `src/services/database` (+ `entityServices` and
  `fetchLimits` in `src/workflows/services.ts`), Zustand slice. Also register the kind in the
  workflow layer:
  - `EntryKind` / the `_kindHeads` list and `commandHeadForKind` in `common/workflows/contracts.ts`;
  - `entityTables` in `domain/entries.ts`;
  - `supporterCapabilities` / `supporterTables` / `collectionMembers` in `domain/` as relevant;
  - `scheduleFields` in `domain/scheduleMaintenance.ts` if it affects plans;
  - `allKinds` and `dependencies()` in `src/workflows/runtime.ts`;
  - list page: `entityRoutes`, `entityRegistry`, `EntityPages.tsx`, router.
- New foreign keys to collections should use `onDelete: 'set null'` and be added to
  `collectionMembers` so deletions announce affected rows.
- Run `bun run build` (tsc) before finishing non-trivial TS changes.
- Do not edit generated migrations by hand; regenerate via drizzle-kit.
- Do not delete user's uncommitted work; repo may have staged changes.

## Notes

- Debug binary name must match Tauri `externalBin` (`../binaries/db-server`).
  Build uses target triple from `rustc --print host-tuple`.
- `optimizeDeps.exclude` includes `bun:sqlite`; do not bundle it in Vite.
- Swagger docs at `http://localhost:3456/api` when server runs.
