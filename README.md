# unHussle

A local-first desktop productivity app for tasks, resources, projects, areas and
goals, with tags, links and time tracking. Fully offline: all data lives in a
local SQLite database.

## Architecture

```
┌──────────── Tauri shell (Rust) ────────────┐
│  React 19 + TypeScript (Vite, :1420)       │
│    Zustand store ◀── reactions ◀── events  │
│        │ commands (HTTP)          ▲ SSE    │
│        ▼                          │        │
│  Elysia/Bun sidecar API (:3456) ──┘        │
│    commands → actions → SQLite (Drizzle)   │
└────────────────────────────────────────────┘
```

- **Desktop:** Tauri 2 spawns the API server as a sidecar binary
  (`binaries/db-server-<triple>`), passing `DB_FILE_URL` and `DB_MIGRATIONS_DIR`.
- **Frontend:** React 19, Zustand, Tailwind CSS 4, shadcn/ui.
- **Backend:** Elysia on Bun, TypeBox validation, Swagger at
  `http://localhost:3456/api`.
- **Database:** SQLite through Drizzle ORM. Migrations in `drizzle_migrations/`
  are applied on server start.

### Data model

| Family      | Kinds                          | Notes                                                                                          |
| ----------- | ------------------------------ | ---------------------------------------------------------------------------------------------- |
| Entities    | `tasks`, `resources`           | Belong to a project / area / goal via foreign keys                                             |
| Collections | `projects`, `areas`, `goals`   | Keep derived `count_tasks` / `count_resources`                                                 |
| Supporters  | `tags`, `urls`, `time_entries` | Attached through junction tables; keep derived `count_tasks` / `count_resources` / `count_pga` |

### Workflows: commands, actions, events, reactions

Mutations run through a small command/event runtime (`common/workflows/runtime.ts`),
used the same way on both sides of the HTTP boundary.

**Backend** (`src-db-server/workflows/`)

- A **command** such as `entity.add` maps to an ordered list of named **actions**
  in `commandHandlers.ts`. For example: `handler:entry.add` → `updateSupporters` →
  `updateSupporterCounts` → `updateCollectionCounts`.
- Actions live in `commandActions.ts`. A command's actions all run in one SQLite
  transaction, and each action's output (new id, deleted rows) is passed on to
  the next.
- After commit, the backend publishes the command-family event (`entity.add`), the
  kind event (`tasks.add`), and any announcements an action queued. One example is
  `announceAffectedEntities`, which reports the members of a deleted or changed
  collection. Events carry an `operationId`.
- `GET /events` streams every event to clients over SSE. Clients can reconnect
  with `Last-Event-ID` to replay missed events, or are told to `resync` when that
  isn't possible.

**Frontend** (`src/workflows/`)

- Store slices and UI call frontend **commands**. These send HTTP with an
  `x-operation-id` header and resolve once the matching events have been handled,
  so callers still see an updated store when the command returns.
- Backend events arrive over SSE (`eventStream.ts`) and are republished on a local
  event bus. **Reactions** (`reactions.ts`), wired per event in
  `reactionRegistry.ts`, update the store, invalidate queries and stop time
  tracking.
- Store state changes only in response to events. A change made in this window,
  another window or by the backend therefore goes through the same code path.

## Getting started

Requirements: [Bun](https://bun.sh), Rust and the
[Tauri prerequisites](https://tauri.app/start/prerequisites/).

```sh
bun install
cp .env.template .env.local   # also create .env.test for tests
bun run tauri dev             # desktop app
```

| Script                                    | Purpose                                                  |
| ----------------------------------------- | -------------------------------------------------------- |
| `bun run dev`                             | Build the sidecar binary, then start the Vite dev server |
| `bun run debug`                           | Vite only (no sidecar build)                             |
| `bun run server` / `server:test`          | Run the API against `.env.local` / `.env.test`           |
| `bun run build`                           | Typecheck, build the sidecar, then `vite build`          |
| `bun run test`                            | Start a test server, run all tests, clean up             |
| `bun run lint` / `lint:fix` / `typecheck` | ESLint / auto-fix / `tsc --noEmit`                       |
| `bunx drizzle-kit generate`               | Generate a migration after schema changes                |

## Project layout

```
src/                 React frontend (components, store slices, services, workflows)
src-db-server/       Elysia API: database/, routes/, workflows/
common/              Shared types, Logger, datetime utils, workflow runtime + contracts
src-tauri/           Tauri shell (sidecar lifecycle)
drizzle_migrations/  SQL migrations (bundled as a Tauri resource)
```

## Direction

The workflow layer is built for extensibility. The next steps are:

- **Custom commands:** let extensions register their own actions and command
  action lists alongside `commandHandlers.ts`.
- **Custom reactions:** let extensions add reactions to frontend events, e.g.
  logic for a single kind via `tasks.add`, by merging into `reactionRegistry.ts`.
- **Announcement events:** consider giving announcements their own event names.
  Today they share kind channels such as `tasks.change` and are told apart by
  payload (`attachedIds`, no `result`).

Known caveats:

- Derived counts are recalculated across the whole table on each relevant command.
  This is fine at personal scale and could be limited to affected rows later.
- The `20261030153840_little_payback` migration rebuilds `time_entries` and copies
  count columns that the old table lacks. SQLite fills them with the column names
  as text on databases that already have rows. The next count recalculation
  overwrites those values.

## Recommended IDE setup

[VS Code](https://code.visualstudio.com/) +
[Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) +
[rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
