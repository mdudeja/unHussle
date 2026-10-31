# AGENTS.md

## Project Overview

`unHussle` is a local-first desktop productivity app. A Tauri (Rust) shell wraps a
React 19 + TypeScript frontend (Vite, served on port 1420) and spawns a local
Elysia/Bun REST API server (port 3456) as a sidecar. All data lives in a local
SQLite database accessed through Drizzle ORM. The app is fully offline.

## Important

This project uses `agentic-indexer` MCP. Use the MCP first to explore the project or go through files when needed, instead of relying on manual exploration or tools like cat, grep, etc. The MCP provides a structured way to understand the codebase, its architecture, and its components. Use the other tools only when the MCP does not return usable results. The MCP is designed to help you navigate the project efficiently and understand its structure and functionality.

## Tech Stack

- Frontend: React 19, TypeScript ~5.8, Zustand, Tailwind CSS 4, Vite 7, shadcn/ui
- Backend (sidecar): Elysia, Bun runtime, TypeBox validation, Swagger
- Desktop: Tauri 2 (Rust)
- Database: SQLite 3 + Drizzle ORM (`drizzle-orm/bun-sqlite`)
- Package manager: `bun`
- Tests: Bun test (`bun:test`) with preload `common/testing/test-setup.ts`

## Commands (bun)

| Script                                          | Purpose                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------- |
| `bun run dev`                                   | Build sidecar binary then start Vite dev server                           |
| `bun run debug`                                 | Vite only (no sidecar build)                                              |
| `bun run build`                                 | `tsc` then build sidecar then `vite build`                                |
| `bun run preview`                               | Vite preview                                                              |
| `bun run tauri`                                 | Tauri CLI                                                                 |
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
src/                 React frontend
  components/        UI (ui/* shadcn, app/*, pages/*, dev/*)
  services/database/ DbService subclasses per entity (HTTP clients)
  store/             Zustand slices (create*Slices pattern)
  workflows/         frontend runtime: commands, SSE event stream, reactions, queries, tracking
  lib/               helpers, input parsers, router, server fetch
  __tests__/         frontend/store tests
src-db-server/       Elysia sidecar API
  server.ts          app bootstrap (port 3456)
  database/          UnHussleDB (singleton), schemas/, validation, seed
  routes/            routeGenerator-based CRUD routes, events.ts (SSE)
  workflows/         backend runtime: command registry, actions, unit of work, counts, supporters
  utils/
common/              Shared Logger, datetimeUtils, types, testing setup,
                     workflows/ (createRuntime + contracts shared by both sides)
src-tauri/           Rust Tauri shell (sidecar lifecycle)
drizzle_migrations/  SQL migrations (bundled as Tauri resource)
drizzle.config.ts
```

## Path Aliases

Defined in `tsconfig.json` and `vite.config.ts`:

- `@/*` -> `src/*`
- `@d/*` -> `src-db-server/*`
- `@c/*` -> `common/*`

Both frontend and sidecar share these aliases.

## Architecture Notes

- Tauri spawns `binaries/db-server-<triple>` with `DB_FILE_URL` and `DB_MIGRATIONS_DIR`.
- Frontend talks to `http://localhost:${VITE_DB_SERVER_PORT}` (default 3456).
- All entities share `routeGenerator` (`src-db-server/routes/routegenerator.ts`) which provides
  `GET /`, `GET /:id`, `GET /search/:term`, `POST /`, `PATCH /:id`, `DELETE /:id`,
  `DELETE /all`. Override in entity route file when needed (see `urls.ts`).
- Mutating routes do not write directly: they execute backend commands
  (`${commandHeadForKind[kind]}.add|change|delete|deleteAll`) on `backendRuntime`.
  `DELETE /all` responds `{ deleted: n }`.
- `UnHussleDB` is a singleton; `getDb()` runs migrations and prepares statements.
- Time tracking state persists in browser localStorage.
- Logging via `common/Logger.ts` (`Logger.getInstance()`), not `console`.

## Workflows (commands → actions → events → reactions)

Both sides use `createRuntime` (`common/workflows/runtime.ts`): typed commands with
one handler each, plus events with any number of listeners (`on`, `onAny`).
Handlers and listeners receive `(name, payload, context)`. Shared types are in
`common/workflows/contracts.ts`.

Command families come from `commandHeadForKind`:

| Family             | Kinds                          |
| ------------------ | ------------------------------ |
| `entity`           | `tasks`, `resources`           |
| `entityCollection` | `projects`, `areas`, `goals`   |
| `entitySupporter`  | `tags`, `urls`, `time_entries` |

Each family has the verbs `add`, `change`, `delete` and `deleteAll`. `entry.*` is
the backend-internal base that the families nest.

**Backend** (`src-db-server/workflows/`)

- `commandHandlers.ts` maps each command to an ordered list of action names.
  `handler:<command>` inlines another command's list, and cycles are rejected.
- `commandActions.ts` holds the named actions. An action
  `(name, input, ActionContext)` returns a **synchronous** `TransactionWorkUnit`.
  All of a command's units run in one transaction (`unitOfWork.ts`); an error
  rolls the whole command back.
- Actions are built one at a time, and `carryForward` feeds each result into the
  next action's input:
  - a created or updated row sets `id`;
  - deleted rows set `attachedIds` (entities/collections, junction `attachedToId`)
    or `ids` (supporters, junction `refId`).
- The command result is the last non-undefined result. Bulk actions return the
  rows themselves.
- After commit, the runtime publishes the family event (`entity.add`), the kind
  event (`tasks.add`), and any events actions queued with
  `ActionContext.announce(...)`. Queued events are dropped on rollback. All
  payloads are `MutationEvent` and carry `operationId`: the client's
  `x-operation-id` header, or a generated id.
- `announceAffectedEntities` publishes `<kind>.change` with `attachedIds` and no
  `result` for the members of a collection. It must run **before** a collection
  delete, because members' foreign keys are `set null` afterwards.
- Derived counts (`count_tasks`, `count_resources`, `count_pga`) are recalculated
  in `counts.ts` and are never client-writable: `toRowValues` strips them.
- Tag titles are normalized (`normalizeTagTitle`) on every write path.
- `routes/events.ts` sends every event to `GET /events` (SSE): numbered frames, a
  replay buffer for `Last-Event-ID`, and `resync` when the gap can't be covered.
  The handler calls `server.timeout(request, 0)` so a quiet stream isn't closed
  as idle (Elysia's default is 30s). `serve` options set on a plugin are ignored,
  so don't rely on them. There is no heartbeat: the client is local, so closing
  either side closes the socket. The gzip `mapResponse` in `server.ts` skips raw
  `Response`s; keep it that way.

**Frontend** (`src/workflows/`)

- Store state changes **only in response to events**. Slices call commands.
  `runtime.ts` sends the HTTP request with `x-operation-id`, then waits (via
  `operations.ts`) until that operation's family and kind events have been
  handled. If the events don't arrive within 3s, it reloads the list instead.
- `eventStream.ts` is the SSE client, built on `fetch`. The webview has
  `EventSource`, but the Bun runtime doesn't, and store tests run the client
  under `bun test`.
  Tests inject a fake `EventTransport`.
- `reactionRegistry.ts` maps events to reaction names; `reactions.ts` implements
  them (`upsertRows` reloads hydrated rows by id, `invalidateDependents`,
  `refreshAnnounced`, tracking cleanup, …).
  - Put generic store reactions on family events, so each mutation is handled
    once.
  - Put kind-specific behaviour on kind events (e.g. `tasks.delete`).
- `task.transition` and `brainDump.submit` are frontend workflow commands.
  Frontend-only events (`tracking.changed`) are declared in
  `src/workflows/contracts.ts`.
  - `task.transition` and task deletes are serialized.
  - `brainDump.submit` returns the URLs that failed, so a retry doesn't repeat
    the writes that succeeded.
- Reads go through the query coordinator (`queries.ts`, `useWorkflowQuery`):
  - requests are deduplicated and empty results are cached;
  - an obsolete response can never overwrite a newer one;
  - detail, search and related queries never change list membership;
  - related panels subscribe only while mounted.
- A refresh that fails after a committed write shows a warning. Its Retry
  repeats only the read, never the write.
- There is one frontend runtime per store (`getFrontendRuntime`, keyed by
  `getState`). Dispose runtimes and queries on teardown and hot reload
  (`disposeFrontendRuntimes`).

Rules for both sides:

- Required integrity work belongs in commands/actions, not in event listeners
  or reactions. A failing listener or reaction never fails a committed write.
- Events are not durable and writes are never retried automatically.

Extending:

- Backend: add an action to `commandActions.ts` (and `CommandAction` in
  contracts), then list it in `commandHandlers.ts`.
- Frontend: add a reaction to `reactions.ts` (and `ReactionName`), then list it
  under an event in `reactionRegistry.ts`.
- The direction is to let extensions register their own actions and reactions by
  merging into these registries.

## Database & Migrations

- Schemas: `src-db-server/database/schemas/*.ts` (Drizzle). Validation: `validation.ts` (TypeBox schemas generated via `drizzle-typebox`).
- Migrations output: `./drizzle_migrations` (config in `drizzle.config.ts`).
- Tauri bundles `drizzle_migrations/` as resource; runtime path via `DB_MIGRATIONS_DIR`.
- DB file path via `DB_FILE_URL` (`.env.local` / `.env.test`).

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
- Shared types live in `common/types`.
- `common` also has some additional utils (Logger, datetimeUtils). Use these instead of ad-hoc implementations.
- This project uses shadcn/ui for UI components. New components as needed can be added using `bunx --bun shadcn@latest add [component-name]`.
- UI Components are available under `src/components/ui` (shadcn) and `src/components/app` (app-specific). Use these as much as possible instead of creating ad-hoc components like <input/>, <button/> etc.

## Testing

- Tests live in `__tests__` folders and `*.test.ts` / `*.spec.ts`.
- Bun preload (`common/testing/test-setup.ts`) resets DB state in `afterAll` via Zustand store
  (through the frontend runtime, so it needs the test server and its event stream).
- The seed (areas, goals and their tags) only runs when both `areas` and `goals` are empty.
  Don't partially delete test DB data by hand: it can leave seeded tags missing for the next run.
- Backend workflow tests use `new UnHussleDB(':memory:')` + `createBackendRuntime(db)`.
  Frontend workflow tests use fake services that emit backend-shaped events through a fake
  `EventTransport` (see `src/__tests__/workflows.test.ts`).
- Always start the test server first (`bun run server:test` or use `bun run test`).
- Coverage enabled by default (`bunfig.toml`); `*.schema.ts` excluded.
- Do not commit test DB contents; `db` and `db_test` are gitignored.

## Environment / Secrets

- `.env.local`, `.env.test` are gitignored; `.env.template` documents vars.
- `.agentic/` is gitignored (local tooling state).
- Never read/commit `.env.*` secrets. Vars: `LOG_LEVEL`, `NODE_ENV`, `DB_FILE_URL`,
  `DB_MIGRATIONS_DIR`, `VITE_DB_SERVER_PORT`, `DB_SERVER_BUILD_DIR`, `DB_SERVER_PORT`.
- Rust sidecar settings via `src-tauri/.env.x11` / `.env.wayland`.

## Conventions for Changes

- Keep changes consistent with generic CRUD route pattern; prefer editing `routeGenerator`.
- Mutations go through workflow commands, never direct writes in routes or direct store
  patches in frontend commands. New side effects become actions (backend) or reactions (frontend).
- Add new entities: schema in `src-db-server/database/schemas`, validation entry,
  junction tables if relations, route file, register in `server.ts`, prepared statements
  in `UnHussleDB.prepareStatements` if using search, service in `src/services/database`,
  Zustand slice. Also register the kind in the workflow layer:
  - `EntryKind` / the `_kindHeads` list and `commandHeadForKind` in `common/workflows/contracts.ts`;
  - `entityTables` in `commandActions.ts`;
  - `supporterCapabilities` / `supporterTables` / `collectionMembers` as relevant;
  - `allKinds` in `src/workflows/runtime.ts`.
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
