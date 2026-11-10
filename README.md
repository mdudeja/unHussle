# unHussle

A local-first desktop app that turns everything on your plate into **one next
task**. You capture tasks, links and ideas quickly. You group them into
projects, areas and goals. unHussle then plans each day around your waking
hours, appointments and daily work limit, and shows you what to do now.

It works fully offline. All data lives in a SQLite database on your machine.

- [Using unHussle](#using-unhussle)
- [Developing unHussle](#developing-unhussle)
- [How data flows](#how-data-flows)
- [Backend](#backend-src-db-server) · [Common](#common-common) ·
  [Frontend](#frontend-src) · [Scheduler](#the-scheduler) ·
  [Telemetry](#telemetry)
- [Testing](#testing) · [Extending](#extending) ·
  [Direction and caveats](#direction-and-caveats)

---

## Using unHussle

### The building blocks

| What             | Is for                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Tasks**        | Things to do. They have a priority, an estimate, a due date, an optional fixed time or recurrence, and flags (fun, chore, quick). |
| **Projects**     | A set of tasks with an outcome. A project can belong to an area and a goal.                                                       |
| **Areas**        | Long-running parts of your life (Work, Health & Fitness, …). Projects, goals and tasks can sit in an area.                        |
| **Goals**        | Something you want to reach, such as "Meditate daily this month". A goal can belong to an area.                                   |
| **Tags**         | Free labels (`#health`). You can tag tasks, projects, areas and goals.                                                            |
| **URLs**         | Saved links. They can stand alone or be attached to a project, task, area or goal.                                                |
| **Time entries** | Created for you whenever you work on a task. They record when you started and stopped.                                            |

On first start, unHussle creates a few example areas and goals with their own
tags. One of them is the **Brain Dump** area, where uncategorised captures go.

### Next task (home)

The home screen shows a single card: the task to do now.

- **Start**, **Pause** and **Done** control the task. A timer runs while you
  work. Starting a task pauses the one you were working on before.
- A task you paused, today or on an earlier day, comes back before new work of
  the same urgency ("You started this earlier").
- If a task has been running since an earlier day, the card asks first instead
  of counting the whole night: **Yes, I'm still on it** keeps it going, or pick
  the time you stopped and only that time is counted. On the Tasks page, the
  same question appears when you pause, complete or cancel such a task.
- **Do something else** sets this task aside and shows the next one in the
  stack. You can keep skipping. Skipped tasks stay aside for the rest of the
  day, even after a reload, until you choose **Show skipped tasks again** or
  re-plan the day.
- **Later today** moves the task to the end of today's stack. **Another day**
  makes a one-off task available again from a date you pick. For a recurring
  task, **Skip this occurrence** skips today's occurrence only.
- **Why this task?** explains why it was picked.
- **Add more** re-plans to fill spare capacity when the stack runs out.
- Appointments (tasks with a fixed start time) take over the card when they
  begin. If an earlier appointment was missed, the card asks what to do.

The first time you open the app each day, it prepares and saves that day's
plan (the "stack").

#### Taking a break

**Taking a break** pauses whatever you're working on and turns the card into a
calm "On a break ☕" view. There is no timer and no countdown. A break is never
something to catch up on. If you're curious, **Peek at what's next** shows what
is waiting. When you press **I'm back**, the stack leads with something easy,
such as a quick or fun task.

#### Wrapping up

When the day is wrapping up, the card shows a **Wrapping up** badge with the
reason, and the stack holds only chores. Anything you're already working on,
appointments and pinned tasks stay. Wrap-up starts:

- when you press **Wrapping up**;
- when you start the last task in your stack. If that task's estimate is longer
  than the wrap-up lead time (30 minutes by default), it starts once that much
  of the task is left;
- within the lead time before your wind-down time. Once wind-down has passed,
  only the last-task trigger applies.

Want to keep going? **Pull more tasks** brings the regular stack back, even
past your wind-down time. Wrap-up then won't start on its own again that day,
but you can still press **Wrapping up** yourself.

### Brain dump

Below the card is the quick-capture box. Type a line and press
**Ctrl+Enter** to save it, or **Esc** to clear it. The text is parsed as you type:

| You type                                                          | It becomes                                                                                                           |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `#work`, `#health_fitness`                                        | The matching project, area or goal (underscores match spaces; one of each). Otherwise, a tag. `#` opens suggestions. |
| `https://…`, `www.…`                                              | A link attached to the task                                                                                          |
| `est: 30m`, `et: 1h 30m`                                          | The task's estimate                                                                                                  |
| `due tomorrow`, `due next friday`, `due 4th January`, `due 12/03` | The due date. Put it at the end of the line.                                                                         |

The toolbar under the box sets priority, the fun/chore/quick/recurring flags, a
due date, a start/end time and a recurrence rule. If you give two of start, end
and estimate, the third is filled in. The expand button opens a larger notes
editor.

A task without a project, area or goal goes into **Brain Dump**. A line with
only links saves them as standalone URLs. If some links fail to save, you can
retry just those.

### Day, Week and Preferences

The sidebar's **Your pace** section has the planner views.

- **Day** shows one day's stack. Appointments appear first, then the flexible
  stack. A saved day can be re-ordered with move up/down, have tasks
  pinned or be rescheduled. An unsaved (tentative) day can be
  saved. When tasks change under a saved day, it is marked as changed but keeps
  your order until you reschedule. A badge shows when the day is on a break or
  wrapping up.
- **Week** previews the next seven days. Each one-off task is given to at most
  one day.
- **Preferences** sets the scheduler:
  - when you are usually awake and when you wind down;
  - which tags count as **work**, and the daily work limit in minutes;
  - default durations for unestimated tasks and quick tasks, how long a
    "starter" task may be, and when a task counts as long;
  - the wrap-up lead time: how long before wind-down, or before the last task
    ends, wrap-up starts (30 minutes by default);
  - per-date overrides ("a different kind of day") with their own hours and
    work limit.

### Library pages

The sidebar also lists your recent Projects, Areas, Goals, Tasks, Resources,
URLs and Tags. Each heading opens its page: a searchable, filterable table with a create
button.

When you select a row, an action bar appears with **Edit** and **Delete**. Tasks
also have **Start**, **Pause**, **Complete** and **Cancel**. Projects, areas and
goals can show their **related tasks**. Projects include directly assigned tasks;
goals also include their projects' tasks; areas include tasks through their
projects, goals and those goals' projects. Tags and URLs show directly attached
items plus tasks from attached collections and their descendants. Duplicate
task paths appear once. A resource attachment returns that resource without
following its links backward to tasks.

### Resources and links

- **Resources** are markdown notes you write in the app. **New Resource** asks
  for a title (and optionally tags and what it's linked to), then opens the
  editor. It saves as you type. Link a resource to any number of tasks,
  projects, areas and goals, from the resource's side panel or from the
  **Resources** field when editing a task or collection.
- **Inheritance.** A task gets the resources, links and tags of its project,
  goal and area too (and of the project's goal and area, and the goals'
  areas). On the home card, the **resources** chip opens them all, grouped by
  where they come from.
- **The vault.** Each resource is a plain `.md` file in the vault folder
  (`<app data>/vault` by default), named after its title. You can edit the
  files in another editor: the app reads the file each time you open it. If
  the file changed while you had it open, the app asks before overwriting it.
  Deleting a resource moves its file to the vault's `.trash` folder. Under
  **Preferences → Resource vault**, **Rescan vault** adds `.md` files you put
  in the folder yourself, and **Move to another folder…** moves the vault to an
  empty folder.
- **Links** can be web addresses or files and folders on your computer. When
  adding a link, use the file or folder buttons to pick one. Clicking a file
  link opens it in its default app, and the folder button next to it shows it
  in your file manager.

### Planning concepts

- **Recurring tasks** produce one occurrence per matching day. A rule can be
  daily, weekly (weekdays), monthly (days of the month) or yearly (months), and
  can have time slots, one occurrence per slot. Each occurrence is tracked
  separately. Skipping or deferring one does not affect the others.
- **Anchors** tie a task to another task: right `before` or `after` it, or
  anywhere before/after it on the same day (`any_before` / `any_after`). For
  a recurring anchor you choose which slot.
- **Fixed times.** A task with a scheduled start is an appointment. Its time
  is never given to flexible work.
- **Pinning.** On the Day page, the pin button next to a
  task in a saved day keeps it in place. A pinned task always stays in the
  stack and returns to its position whenever the day is re-planned, including
  for a break, wrap-up or **Add more**. Press the pin again to release it.
- **Time tracking** is automatic. Starting a task opens an interval and pausing,
  completing or cancelling closes it. Time spent is totalled per task and per
  occurrence, and the daily work limit counts tracked work. A recurring
  occurrence belongs to its day: one paused yesterday counts as missed, and
  today has a fresh one. Appointments from earlier days that weren't done
  leave planning; you can reschedule them from the Tasks page.

### Where your data lives

The desktop app stores its database at `<app data>/db/ecn.unhussle.sqlite`
(the Tauri app id is `tech.exitcodenone.unhussle`), and resource files in
`<app data>/vault` unless you move the vault. The server also writes
diagnostic spans to `telemetry.jsonl` next to it. Those spans hold ids, counts
and timings, never your text.

---

## Developing unHussle

### Requirements and setup

You need [Bun](https://bun.sh), Rust and the
[Tauri prerequisites](https://tauri.app/start/prerequisites/).

```sh
bun install
cp .env.template .env.local   # and a .env.test for tests (separate DB file)
bun run tauri dev             # desktop app: builds the sidecar, starts Vite + Tauri
```

To work on the frontend in a browser, run `bun run server` in one terminal and
`bun run debug` in another, then open `http://localhost:1420`.

| Script                                    | Purpose                                                  |
| ----------------------------------------- | -------------------------------------------------------- |
| `bun run tauri dev` / `tauri build`       | Desktop app (dev / bundle)                               |
| `bun run dev`                             | Build the sidecar binary, then start the Vite dev server |
| `bun run debug`                           | Vite only (no sidecar build)                             |
| `bun run server` / `server:test`          | Run the API against `.env.local` / `.env.test`           |
| `bun run build`                           | Typecheck, build the sidecar, then `vite build`          |
| `bun run test`                            | Start a test server, run all tests, stop the server      |
| `bun run lint` / `lint:fix` / `typecheck` | ESLint / auto-fix / `tsc --noEmit`                       |
| `bunx drizzle-kit generate`               | Generate a migration after a schema change               |

Environment variables (see `.env.template`):

| Variable                     | Used by  | Meaning                                            |
| ---------------------------- | -------- | -------------------------------------------------- |
| `DB_FILE_URL`                | server   | SQLite file (the desktop app sets it)              |
| `DB_MIGRATIONS_DIR`          | server   | Migrations folder (the desktop app sets it)        |
| `VITE_DB_SERVER_PORT`        | both     | API port, default `3456`                           |
| `VITE_LOG_LEVEL`, `NODE_ENV` | both     | Logging level / environment                        |
| `VITE_SEARCH_RESULTS_COUNT`  | server   | Max rows per `/search/:term` (default 20)          |
| `VITE_FETCH_LIMIT_<KIND>`    | frontend | Page size per list (e.g. `VITE_FETCH_LIMIT_TASKS`) |
| `DB_SERVER_BUILD_DIR`        | build    | Where `build:server` writes the sidecar binary     |

### Architecture at a glance

```
┌────────────────────────── Tauri shell (Rust, src-tauri/) ───────────────────────────┐
│ spawns the sidecar with DB_FILE_URL + DB_MIGRATIONS_DIR, stops it on exit           │
│                                                                                     │
│  React 19 webview (src/, Vite :1420)                                                │
│   components ─▶ store slices / hooks ─▶ frontend runtime ──── HTTP + x-operation-id ─┐│
│        ▲              ▲                     ▲                                       ││
│        │         Zustand store ◀── reactions ◀── local event bus ◀── SSE /events ──┐ ││
│        └──── query coordinator (reads, dedupe, invalidation) ◀── HTTP GET ───────┐ │ ││
│                                                                                  │ │ ││
│  Elysia/Bun sidecar (src-db-server/, :3456)                                      │ │ ││
│   routes ─▶ backend runtime: command ─▶ actions (one SQLite transaction) ◀───────┼─┼─┘│
│                 │ after commit: publish events ─▶ SSE forwarder ─────────────────┼─┘  │
│   repositories (hydrated reads) ◀────────────────────────────────────────────────┘    │
│   SQLite via Drizzle ORM, migrations applied on start                                 │
└───────────────────────────────────────────────────────────────────────────────────────┘
        common/ — shared runtime, contracts, scheduler engine, types, utils
```

- **Desktop** (`src-tauri/src/lib.rs`): on startup Tauri spawns
  `binaries/db-server-<triple>`. It passes the app-data DB path and the bundled
  `resources/drizzle_migrations`. On exit it sends SIGTERM to the sidecar, then
  kills it if needed.
- **Frontend**: React 19, React Router 7, Zustand, Tailwind CSS 4, shadcn/ui,
  TanStack Table.
- **Backend**: Elysia on Bun with TypeBox validation (generated from the Drizzle
  schemas with `drizzle-typebox`). Responses are gzipped. Swagger is at
  `http://localhost:3456/api`.
- **Database**: SQLite (WAL, foreign keys on) through Drizzle ORM. Migrations in
  `drizzle_migrations/` run on server start. Areas, goals and their tags are
  seeded when both tables are empty.

### Data model

| Family      | Kinds                                                                                       | Notes                                                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entities    | `tasks`, `resources`                                                                        | Belong to a project / area / goal through `set null` foreign keys. Tasks can anchor to another task.                                                                        |
| Collections | `projects`, `areas`, `goals`                                                                | Projects → area, goal. Goals → area. Derived `count_tasks` / `count_resources`.                                                                                             |
| Supporters  | `tags`, `urls`, `time_entries`                                                              | Attached through junction tables (`attachedToId` → owner, `refId` → supporter). Derived `count_tasks` / `count_resources` / `count_pga`.                                    |
| Scheduler   | `day_plans`, `plan_items`, `task_occurrences`, `scheduling_overrides`, `scheduler_settings` | Saved stacks per `timezone:date` with their day mode (`break_started_at`, `wrap_reason`, `auto_wrap`), recurring occurrences (`taskId:date:slot`), deferrals, and settings. |

Shared row types (`Read` / `Write` / `Update`) and hydrated shapes live in
`common/types`. List reads include table projections and reference labels. Flat edit reads include direct attachments; task history stays in task detail reads.

---

## How data flows

### A write, end to end

Here is what happens when you click **Start** on a task:

1. **UI → frontend command.** `startTask(id)` runs the frontend command
   `task.transition`. Task transitions, deletes and scheduler commands are
   serialized. The UI sends one request; the backend pauses competing work
   in the same transaction as the start.
2. **Frontend runtime → HTTP.** The runtime creates an `operationId`. It
   registers the events it expects (`entity.change`, `tasks.change`) and waits
   up to 1s for the event stream to connect. Then it sends
   `PATCH /tasks/:id` with `x-operation-id`, `x-trace-id` and
   `x-parent-span-id`.
3. **Route → backend command.** `routeGenerator` runs the backend command
   `entity.change` on `backendRuntime`. The route never writes itself.
4. **Actions in one transaction.** `commandHandlers.ts` expands
   `entity.change` into `updateRow → validateTask → trackTaskInterval →
updateSupporters → updateSupporterCounts → updateCollectionCounts →
markPlansStale → syncPlanMembership`. Each action returns a synchronous unit
   of work. All units run in one SQLite transaction, and each result
   (`id`, deleted ids) is carried into the next action's input. Any error rolls
   everything back, including pauses of competing tasks. Action adapters
   delegate validation and persistence behavior to `src-db-server/domain/`.
5. **Publish after commit.** The backend publishes dependent announcements
   first, then `entity.change` (the family) and `tasks.change` (the kind).
   The route reads the hydrated row back and returns it.
6. **SSE.** The event forwarder numbers each event and streams it on
   `GET /events`. It keeps a 500-frame replay buffer for `Last-Event-ID`.
7. **Reactions.** The frontend republishes each event on its local bus.
   `reactionRegistry.ts` runs `upsertRows`, which reloads the hydrated row by id
   into the Zustand store, and `invalidateDependents`, which refreshes mounted
   queries that depend on `tasks`.
8. **Settle.** Once both expected events are handled, the command resolves and
   the caller sees the updated store. If the events don't arrive within 3s, the
   runtime reloads the list instead. If a follow-up refresh fails, a warning
   appears with a **Retry** that repeats only the read.

The store changes **only** in reaction to events. A write from this window,
another window or the backend itself all update the UI the same way.

### A read

Reads never go through commands. Components call `useWorkflowQuery` (or
`useEntryList`, `useEntryDetail`, `useEntrySearch`, `useDayPlan`, …). These
register a query with the **query coordinator** (`src/workflows/queries.ts`),
keyed like `list:tasks:1`, `detail:areas:<id>`, `search:tags:<term>` or
`schedule:day:<tz>:<date>`. Each query declares the kinds it depends on.

- Identical requests in flight are shared, and results (including empty ones)
  are cached until invalidated.
- Every invalidation bumps a generation, so a slow, outdated response can never
  overwrite a newer one.
- Only list queries write into the store (`onData`). Detail, search and
  related queries never change list membership.
- Queries refetch on invalidation only while a component has them mounted.
  Unmounted queries are just marked stale.

### Scheduler flow

The scheduler follows the same pattern with its own commands. Its endpoints
are under `/scheduler`:

| Frontend command                  | HTTP                            | Event published                |
| --------------------------------- | ------------------------------- | ------------------------------ |
| `scheduler.generate`              | `POST /scheduler/generate`      | `scheduler.changed`            |
| `scheduler.replan`                | `POST /scheduler/replan`        | `scheduler.changed`            |
| `scheduler.adjust`                | `POST /scheduler/adjust`        | `scheduler.changed`            |
| `scheduler.mode.change`           | `POST /scheduler/mode`          | `scheduler.mode.changed`       |
| `scheduler.settings.change`       | `PATCH /scheduler/settings`     | `scheduler.settings.changed`   |
| `scheduler.occurrence.transition` | `POST /scheduler/occurrence`    | `scheduler.occurrence.changed` |
| `scheduler.tracking.stop`         | `POST /scheduler/tracking/stop` | `scheduler.tracking.stopped`   |

Reads: `GET /scheduler/day/:date`, `/next/:date`, `/week/:date` (each with
`?timezone=`) and `GET /scheduler/settings`. The `refreshSchedule` reaction
invalidates the schedule queries, plus `occurrences`, `tasks` and
`time_entries` for occurrence and day mode changes.

`scheduler.mode.change` takes `startBreak`, `endBreak` or `startWrap` (with a
`reason`: `manual`, `lastTask` or `windDown`):

- `startBreak` pauses all open work (`pauseOpenWork`) and re-plans with the
  `break` cue in one backend transaction. A rejected break leaves work running.
- `endBreak` only clears the break. The stack planned at the start is kept.
- `startWrap` re-plans with the `wrap` cue. An automatic reason is ignored
  during a break or after the user pulled more (`auto_wrap = false`).
- While a day is wrapping up, every re-plan uses `wrap`, except `more`, which
  ends wrap-up and clears `auto_wrap`.

`scheduler.tracking.stop` (`{ taskId, occurrenceId, at }`) closes a running interval at
`at`, which must fall between its start and now, and pauses the task or
occurrence. The home card offers it when `runningSinceEarlierDay` is true. On the Tasks
page, `useTaskActions` checks `overnightStart(task)` before Pause, Complete
and Cancel, and opens `OvernightDialogHost` (`askOvernight` in the UI slice)
instead. Either way, an interval left open overnight isn't counted in full
unless the user says so. A "still on it" answer is remembered per interval
(`overnightKey`).

`useTodayPlan` sends the automatic `startWrap` when `wrapUpReason(plan, now)`
in `common/scheduler/dayMode.ts` returns a reason.

Entity commands keep saved plans consistent. `markPlansStale` flags current and
future plans when a schedule-relevant field changes. `syncPlanMembership`
updates or cancels plan rows and occurrences of changed or deleted tasks.

---

## Backend (`src-db-server/`)

```
server.ts            Elysia app: gzip mapResponse, swagger, cors, /health, routes, /events, /telemetry
database/
  UnHussleDB.ts      singleton; getDb() opens SQLite, sets pragmas, runs migrations
  schemas/           Drizzle tables + relations (entities, collections, supporters, junctions, scheduler)
  validation.ts      TypeBox insert/select/update schemas (drizzle-typebox) + scheduler schemas
  repositories/      hydrated reads per kind (getAll, getPaginated, getById, search, getByIds, …)
  seed/              default areas, goals and tags
routes/
  routegenerator.ts  generic CRUD routes per kind; mutations execute commands
  <kind>.ts          one routeGenerator call per kind; tags/urls add GET /:id/items
  scheduler.ts       /scheduler reads + commands
  events.ts          SSE forwarder (numbered frames, replay buffer, resync)
  telemetry.ts       http spans, x-operation-id header, GET /telemetry
workflows/
  runtime.ts         createBackendRuntime: registers mutation + scheduler commands
  commandHandlers.ts command → ordered action names
  commandActions.ts  named action adapters over domain services
  contracts.ts       backend-only action, transaction and publication types
  schedulerHandlers.ts / schedulerActions.ts   scheduler command → actions over a carried state
  scheduler.ts       composeDay, readDay, readNext, previewWeek (reads, never write)
  unitOfWork.ts      one transaction for a list of synchronous work units
domain/
  entries.ts         normalized row persistence, server-owned field protection
  tasks.ts           stored-task validation, lifecycle and overnight stop validation
  collections.ts     announcements before foreign keys are nulled
  tracking.ts        exclusive intervals, totals and saved-plan membership
  supporters.ts      supporter synchronization and junction cleanup
  counts.ts          derived counts
  resourceLinks.ts / resourceFiles.ts  link integrity and compensated vault changes
  vault.ts           content saves/conflicts, rescan, vault folder moves and info
  scheduleMaintenance.ts  affectsSchedules, syncPlanMembership
```

**Routes.** `routeGenerator` gives every kind `GET /`,
`GET /paginated/:page/:pageSize`, `GET /:id`, `GET /search/:term` (a leading
`#` is ignored), `POST /`, `PATCH /:id`, `DELETE /:id` and `DELETE /all`
(`{ deleted: n }`). Reads call the repository directly. Writes call
`${commandHeadForKind[kind]}.add|change|delete|deleteAll` and return the
hydrated row.

**Membership and read projections.** `database/repositories/taskMembership.ts`
defines the SQL containment predicates shared by paged task retrieval and
resolved totals. Collection lists never embed descendant task arrays. Their
`count_tasks` remains the direct-assignment count and `resolved_task_total` is
computed with a batched count query.

`GET /projects|goals|areas|tags|urls/:id/detail` returns
`{ item, directRelations, tasks: { items, total, nextCursor } }`.
Filtering and ordering happen in SQL before pagination and projection fetching.
Task pages default to 20 rows (maximum 100), support title search, status,
priority and task flags, and use cursors scoped to the container, filters and
ordering. Tag/URL `/:id/items` routes use the same explicit response shape.
Direct attachments remain separate from derived task membership and upward
context. Flat `GET /:kind/:id` edit reads preserve direct editable attachments.

`GET /:kind/references` supplies lightweight id/title, collection icon/color
and tag labels for selectors and autocomplete, with search, selected IDs and
continuation. Badges render the supplied label even when its collection is
absent from the loaded list. Task table projections contain open timer
intervals; task edit reads retain their full own history. Resource content is
excluded from all these projections.

**Contracts.** Public commands/events are in `common/workflows/contracts.ts`.
Backend execution types live in `src-db-server/workflows/contracts.ts`. Runtime
enums live in `common/types/enums.ts`; schema-derived types use `import type`,
so enum imports do not pull the schema graph into runtime dependencies.

**Commands and actions.** The command families are:

| Family             | Kinds                          | `add` / `change` also run…                                                               |
| ------------------ | ------------------------------ | ---------------------------------------------------------------------------------------- |
| `entity`           | `tasks`, `resources`           | task validation, interval tracking, supporters, all counts, plan staleness/membership    |
| `entityCollection` | `projects`, `areas`, `goals`   | supporters, supporter counts, `announceAffectedEntities` (change/delete), plan staleness |
| `entitySupporter`  | `tags`, `urls`, `time_entries` | junction cleanup on delete, plan staleness (tags only)                                   |

Each family has `add`, `change`, `delete` and `deleteAll`. `handler:entry.*`
inlines private row templates, and cycles are rejected. Templates cannot be
executed directly; per-kind names such as `tasks.change` are events, and public
commands must use the correct family for their kind. Scheduler commands run
`expireOccurrences → loadPlan → checkRevision → … → savePlan` over one
`SchedulerState`. A stale `revision` gets a 409.

**Backend-owned data.** These are never taken from the client:

- `toRowValues` strips derived counts and supporter keys;
- when `status` changes, it also strips `spent_minutes`, `started_at` and
  `completed_at`;
- it computes URL `parts` and normalizes tag titles.

`trackTaskInterval` and `trackOccurrenceInterval` open and close
`time_entries`. Starting work closes every other open interval and pauses its
task.

**Events.** After commit, the backend publishes the family event, the kind
event and queued announcements. All are `MutationEvent`s carrying
`operationId`. `announceAffectedEntities` publishes `<kind>.change` with
`attachedIds` and no `result` for a collection's members. It runs **before**
a delete, because the members' foreign keys are nulled afterwards. A failing
listener is logged and never fails the write.

---

## Common (`common/`)

| Path                                   | What                                                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `workflows/runtime.ts`                 | `createRuntime`: one handler per command, any number of event listeners (`on`, `onAny`), telemetry spans |
| `workflows/contracts.ts`               | Public `EntryKind`, `commandHeadForKind`, `MutationInput/Event`, `MutationCommands`, `AppEvents`         |
| `workflows/telemetry*.ts`              | span recorder, ring buffer, sinks, trace headers                                                         |
| `scheduler/`                           | the pure planning engine shared by both sides (see below)                                                |
| `taskSchedule.ts`                      | derive the missing one of start / end / estimate; validate end > start                                   |
| `types/`                               | row types (`Read`/`Write`/`Update`), hydrated shapes, `ProgressStatus`, `Priority`, `AnchorType`         |
| `datetimeUtils.ts`, `calendarUtils.ts` | time zone–aware millis, local dates, calendar date math (Temporal)                                       |
| `Logger.ts`                            | `Logger.getInstance()`. Use it instead of `console`.                                                     |
| `testing/test-setup.ts`                | Bun preload that resets the test DB after the run                                                        |

### The scheduler

- `preparation.ts` expands tasks into **plan entries**: one per one-off task,
  one per recurring slot (`taskId:date:slot`). It works out each entry's
  remaining minutes, fixed time, window and priorities (task, project, goal,
  area).
- `engine.ts → buildDay` owns the hard constraints: the wake-to-sleep window
  (from now, for today), appointments, slot windows, anchors, capacity and the
  daily work limit. `nextTask` picks the card's item: active work, then a
  current appointment, then the first ready entry that fits before the next
  appointment.
- `rules.ts` holds the **preferences**. Pickers claim entries in order:
  `keepActive`, `preScheduled`, `recurringOccurrences`, `urgentCandidates`,
  `resumePaused` (paused one-offs), `dueSoon`, `priorityRanking`,
  `dueDateRanking`, `oldestFirst`, and `wrapChores` (chores only). Arrangers only reorder: `starterTask`,
  `easyReturn`, `quickOrFunBetweenLong`, `choresLast`,
  `restorePins`.
- `ruleRegistry.ts` lists the rules for each **cue**:
  - `fresh`: the normal plan, leading with an easy starter;
  - `break`: planned when a break starts, leading with an easy return;
  - `wrap`: active work, appointments and pins, then only chores;
  - `more`: fills spare capacity.

  `settings.rules` can replace a cue's list. `wrap` and `more` may plan past
  wind-down, until midnight.

- `dayMode.ts`: `dayModeOf` (`normal` / `break` / `wrap`), `windDownOf`, and
  `wrapUpReason`, which decides when wrap-up starts automatically.
- `anchors.ts` resolves anchor targets, groups and violations.
  `validation.ts` checks recurrence rules and settings.

---

## Frontend (`src/`)

```
main.tsx / lib/router.ts   routes: / (Next task), /day, /week, /scheduler/settings, /projects, /areas, /goals, /tasks, /urls, /tags
pages/                     HomePage, PlannerPages (Day/Week/Preferences), EntityPages (list pages)
components/
  ui/                      shadcn/ui + ui/custom (pickers, forms, DataTable, …)
  app/                     NextTaskCard, BrainDumpInput, EntityActionBar, Create*Button, WorkflowWarnings, …
  pages/                   EntityListPage, PageView
  dev/                     WorkflowInspector (Ctrl+Shift+O, dev only)
lib/
  entityActions/           per-kind labels, form fields and actions (Edit, Delete, Start, …)
  inputParsers/            brain dump parsing: hashtags, URLs, estimates, due dates
  hooks/                   autocomplete, related items, debounce
services/
  database/                DbService per kind: HTTP client for the CRUD routes (adds mutation headers)
  scheduler.ts             HTTP client for /scheduler
store/                     Zustand store; one generic DbSlice per kind + UI slice
workflows/
  runtime.ts               createFrontendRuntime / getFrontendRuntime
  commandRegistry.ts       verb → service call (add→create, change→update, …)
  eventStream.ts           SSE clients (EventSource in the webview, fetch under Bun)
  operations.ts            waits for an operation's events to be handled
  reactionRegistry.ts      event → ordered reaction names
  reactions.ts             upsertRows, removeRows, clearRows, invalidateDependents, refreshAnnounced, refreshSchedule, tracking cleanup
  queries.ts / hooks.ts    query coordinator + React hooks
  schedulerHooks.ts        useTodayPlan (auto-generates today, auto-starts wrap-up), useDayPlan, useSchedulerClock,
                           useSchedulerAction, useSkippedTasks ("Do something else", per day in localStorage)
  taskCommands.ts          startTask, pauseTask, completeTask, cancelTask, deleteTask
  tracking.ts              active tracking session (localStorage) + workflow warnings
  telemetry.ts             frontend spans, global error capture
```

**Slices call commands.** Each `DbSlice` (`createDbConnectedStoreSlice.ts`)
exposes `data`, `isLoading`, `error`, `fetch`, `search`, `add`, `update`,
`remove`, `reset` and `getById`. Mutations go through
`runtime.commands.execute(...)`. Slices never patch `data` themselves.

**Frontend commands.** Besides the three mutation families and the scheduler
commands, the frontend has two workflows of its own:

- `task.transition`: serialized status changes. A `change` that includes a
  `status` is routed here. It keeps the local tracking session in step and
  publishes `tracking.changed`.
- `brainDump.submit`: creates the task (filling in the Brain Dump area when it
  has no collection) or the standalone URLs. It returns `failedUrls`.

**Reactions.** Generic store reactions hang off **family** events, so each
mutation is handled once. Kind-specific behaviour hangs off **kind** events:
`tasks.delete` stops tracking a deleted task, and `<kind>.change`
announcements reload the members that are already loaded. `syncTracking`
reconciles local timer presentation against committed task state. Failed starts
preserve the existing session; failed timer reads offer a retry that only reads.

**Runtime lifetime.** There is one runtime per store (`getFrontendRuntime`,
keyed by `getState`). `disposeFrontendRuntimes()` closes the SSE stream,
pending operations, listeners and queries. It runs on hot reload and after the
tests.

---

## Telemetry

Both runtimes record a span for each command, event and listener. The backend
adds `action` and `http` spans. The frontend adds `reaction`, `http`, `wait`
and `query` spans, plus signals: `events.timeout`, `stream.resync`,
`stream.reconnect` and `refresh.failed`. Uncaught errors and render errors
become `error` spans.

The trace id is the frontend root command's trace. It is sent as
`x-trace-id` / `x-parent-span-id` and mapped back to the trace when the
operation's events arrive.

The backend keeps the last 2 000 spans (`GET /telemetry?traceId=&kind=&status=&since=&limit=`)
and appends them to `telemetry.jsonl`, which rotates at 5 MB. In dev,
**Ctrl+Shift+O** opens the Workflow Inspector, which merges both halves per
trace.

Span attributes hold ids and counts, never user data. Telemetry is never
published as an app event.

---

## Testing

For repeatable command, refresh and relationship measurements, run
`bun run baseline /tmp/unhussle-baseline.json`. It uses a temporary database
and vault. See the [baseline and cleanup report](docs/baselines/steps-1-2.md)
for the recorded results and known relationship behavior.

```sh
bun run test     # starts a server on .env.test, runs **/__tests__, stops it
```

- Backend workflow tests use `new UnHussleDB(':memory:')` +
  `createBackendRuntime(db)`.
- Frontend workflow tests use fake services that emit backend-shaped events
  through a fake `EventTransport` (`src/__tests__/workflows.test.ts`).
- Store tests run against the real test server and its event stream. The
  preload resets every kind through the store afterwards.
- Coverage is on by default. `*.schema.ts` is excluded.

---

## Extending

- **New backend side effect:** add an action to `commandActions.ts` and to
  `CommandAction` in `src-db-server/workflows/contracts.ts`. Put integrity
  behavior in a domain service and list the action under the
  commands in `commandHandlers.ts`. Actions must return a synchronous unit of
  work.
- **New frontend behaviour on an event:** add a reaction to `reactions.ts` and
  `ReactionName`. Then list it under the event in `reactionRegistry.ts`.
- **New planning preference:** add a rule to `common/scheduler/rules.ts` and
  `planRuleNames`. Then place it in the cue lists in `ruleRegistry.ts`.
- **New entity kind:** see the checklist in `AGENTS.md`.

---

## Direction and caveats

- **Extensions** should eventually register their own actions, reactions and
  plan rules by merging into these registries.
- **Announcement events** share kind channels (`tasks.change`) and are told
  apart by payload (`attachedIds`, no `result`). They may get their own names.
- **Derived counts** are recalculated across whole tables on each relevant
  command. That is fine at personal scale and could be limited to affected
  rows later.
- **Events aren't durable** and writes are never retried automatically. A
  missed event is covered by the 3s fallback reload or by an SSE `resync`.

## Recommended IDE setup

[VS Code](https://code.visualstudio.com/) +
[Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) +
[rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
