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

This project uses shadcn/ui for UI components. New components as needed can be added using `bunx --bun shadcn@latest add [component-name]`.

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
| `bunx drizzle-kit ...`                          | DB migrations (config in `drizzle.config.ts`)                             |
| `bunx --bun shadcn@latest add [component-name]` | Add new shadcn/ui component                                               |

Avoid `npm`/`yarn`/`pnpm`; lockfile is `bun.lock`.

## Repository Layout

```
src/                 React frontend
  components/        UI (ui/* shadcn, app/*, pages/*, dev/*)
  services/database/ DbService subclasses per entity (HTTP clients)
  store/             Zustand slices (create*Slices pattern)
  lib/               helpers, input parsers, router, server fetch
  __tests__/         frontend/store tests
src-db-server/       Elysia sidecar API
  server.ts          app bootstrap (port 3456)
  database/          UnHussleDB (singleton), schemas/, validation, seed
  routes/            routeGenerator-based CRUD routes
  utils/
common/              Shared Logger, datetimeUtils, types, testing setup
src-tauri/           Rust Tauri shell (sidecar lifecycle)
drizzle_migrations/  SQL migrations (bundled as Tauri resource)
drizzle.config.ts
docs/                developer docs, plans, diagrams
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
- `UnHussleDB` is a singleton; `getDb()` runs migrations and prepares statements.
- Time tracking state persists in browser localStorage.
- Logging via `common/Logger.ts` (`Logger.getInstance()`), not `console`.

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
- ESLint not wired in scripts; rely on `tsc` (`bun run build`).
- Format on write is handled by harness hooks when enabled.
- Use path aliases instead of relative deep imports where practical.
- Shared types live in `common/types`.

## Testing

- Tests live in `__tests__` folders and `*.test.ts` / `*.spec.ts`.
- Bun preload (`common/testing/test-setup.ts`) resets DB state in `afterAll` via Zustand store.
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
- Add new entities: schema in `src-db-server/database/schemas`, validation entry,
  junction tables if relations, route file, register in `server.ts`, prepared statements
  in `UnHussleDB.prepareStatements` if using search, service in `src/services/database`,
  Zustand slice.
- Update `docs/plan/frontend_tasks.md` checklist when implementing a tracked task.
- Run `bun run build` (tsc) before finishing non-trivial TS changes.
- Do not edit generated migrations by hand; regenerate via drizzle-kit.
- Do not delete user's uncommitted work; repo may have staged changes.

## Notes

- Debug binary name must match Tauri `externalBin` (`../binaries/db-server`).
  Build uses target triple from `rustc --print host-tuple`.
- `optimizeDeps.exclude` includes `bun:sqlite`; do not bundle it in Vite.
- Swagger docs at `http://localhost:3456/api` when server runs.
