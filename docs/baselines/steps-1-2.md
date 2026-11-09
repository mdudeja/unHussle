# Baseline and obsolete-code cleanup

Scope: steps 1 and 2 of `UnHussle_plan.md` only. Recorded on 2026-11-09
against starting commit `2aeb164`, Linux x64, Bun 1.4.3, Rust 1.99.0.
Existing edits to AGENTS.md and the untracked plan were preserved.

## Reproduce

From the repository root, with dependencies installed:

```sh
bun run typecheck
bun run lint
bun run test
bun run build
bun run baseline /tmp/unhussle-baseline.json
cargo check --manifest-path src-tauri/Cargo.toml --locked --offline
```

The baseline command creates a temporary SQLite database and vault, chooses a
local ephemeral port, starts its own sidecar, polls health, and removes its
temporary files after stopping that process. It does not use the user's DB or
vault. Its optional argument writes clean JSON to a file; without it the report
goes to stdout alongside the existing logger startup message.

The reusable fixture is `common/testing/relationshipFixture.ts`. It creates an
area, a goal, two projects directly in both, another project reachable only via
the goal, and seven tasks. One task belongs directly to the area, goal and
project and also carries the same tag as the area and project. This exercises
duplicate paths, direct memberships, siblings, descendants and an unrelated task.

`common/testing/baseline.ts` uses the production frontend command/query runtime,
real sidecar HTTP routes and Bun's fetch SSE transport, with instrumented HTTP
adapters. It loads all entity lists and activates a task search, then measures
five sequential task title/tag edits through event settlement and refreshes.
Fixture creation, initial reads, health polling and SSE traffic are excluded
from request counts. Sizes are decoded UTF-8 JSON bytes, not compressed wire
bytes. Duplicate reads mean repeated GETs to the same path within one command.
The harness does not measure browser rendering, WebKit or Tauri startup.

## Check results

| Check | Before removal | After removal |
| --- | --- | --- |
| Typecheck | Pass | Pass |
| Lint | Pass | Pass |
| Full tests | 367 pass, 0 fail; 1,052 assertions | 367 pass, 0 fail; 1,052 assertions |
| Production build | Pass | Pass |
| Rust check, locked and offline | Not measured | Pass |

No application check failures were found. The initial sandboxed test run could
not bind the server (`EPERM`); the rerun with local network permission passed.
Both production builds emitted the existing Vite warning about chunks exceeding
500 kB. The fixed startup sleep in the test runner is unchanged (step 12).

## Measurements

Raw samples: [before](steps-1-2-before.json), [after](steps-1-2-after.json).

| Task edit metric | Before removal | After removal |
| --- | --- | --- |
| Latency samples, ms | 24.84, 9.71, 11.70, 8.88, 8.26 | 25.28, 10.53, 10.51, 7.69, 7.13 |
| Median latency, ms | 9.71 | 10.51 |
| Requests per command | 4 | 4 |
| Duplicate GETs per command | 0 | 0 |
| Total response bytes per command | 15,836 | 15,836 |
| Timeout/resync/refresh-failure signals | 0 | 0 |

Every edit produced one PATCH response (1,797 bytes), one task-detail GET
(1,797 bytes), one tag-list GET (4,838 bytes) and one active task-search GET
(7,404 bytes). The write response and subsequent detail response contain the
same hydrated task; this is repeated data even though it is not a duplicate GET.
Timing varies with machine load and warmup; five samples do not establish a
performance improvement or regression.

Relationship results were identical before and after removal:

| Detail read | Fixture task names returned | `count_tasks` | Response bytes |
| --- | --- | --- | --- |
| Project | directProject, multiplePaths, directArea, directGoal | 2 | 3,500 |
| Goal | directGoal, multiplePaths, directArea, directProject, sibling, indirect | 2 | 5,129 |
| Area | directArea, multiplePaths, directProject, sibling, directGoal, indirect | 2 | 5,001 |
| Tag items | multiplePaths, directArea, directProject | Not returned | 8,817 |

All results deduplicate task IDs and exclude the unrelated task. These are
characterizations of existing behavior, not the intended containment contract:

- Project detail includes direct tasks of its parent area and goal.
- Goal detail includes direct tasks of its parent area.
- Tag items expands only directly attached containers: it misses the goal,
  sibling-project and indirect-project tasks reached through the tagged area.
- Collection `count_tasks` is a direct-assignment count and differs from the
  merged detail task total. It must not be interpreted as a resolved total.

Those discrepancies are recorded for steps 4 and 5; no membership, count or
response-contract changes were made here.

## Removal audit

Consumers were checked in source, tests, import/export barrels, router and form
registries, configuration, documentation, Rust registration and capabilities.
No dynamic imports or registrations reference the deleted components/helper.

| Removed | Evidence |
| --- | --- |
| `TaskForm.tsx` and its barrel export | Only referenced by that export; current task creation/editing uses registry-backed forms |
| `DesignSystem.tsx` | No imports, routes or mounts |
| `getNumberOfDaysInMonth` | No consumers, tests, re-exports or dynamic references; Temporal calendar helpers remain |
| Rust `greet` and its invoke registration | Template-only command; no frontend invocation |
| Tauri filesystem plugin's direct JS/Rust dependencies, registration and capability | No frontend filesystem API calls; vault uses Bun/Node filesystem APIs; Rust uses `std::fs` |
| Tauri SQL JS dependency | No imports, Rust registration or capability; persistence uses Bun SQLite |
| Tauri shell JS dependency | No JS imports; Rust shell dependency, registration and permission retained for sidecar lifecycle |
| `uuid`, `@types/uuid` | No imports; app uses cuid2 and native `crypto.randomUUID` |
| Direct `date-fns` | No imports; react-day-picker owns its dependency, and Base UI's peer is optional |
| Direct `clsx`, `tailwind-merge` | No imports; UI uses `cn`, which has neither as a runtime dependency |
| `@redux-devtools/extension` | No imports or peer requirement; Zustand devtools middleware uses the browser extension API |
| Direct `bun-types` | Already provided at the same version by `@types/bun`; Drizzle's optional peer remains satisfied |

Used `bun run tauri remove fs` and `bun remove` to update manifests and lockfiles.
`bun run tauri remove sql` reported no Cargo dependency to remove (SQL was JS
only); its JS package was then removed with `bun remove`. Lockfiles were not
edited manually. Rust `tauri-plugin-fs` remains in Cargo.lock because the dialog
plugin depends on it; this is expected. Date utilities and clsx may also remain
transitively for other packages. `shadcn` remains required by the CSS import;
`cn`, the Temporal utilities and the dialog/opener plugins remain in use.
The installed dialog 2.8.4 implementation uses optional `try_fs_scope()` checks,
so its file/folder pickers do not require filesystem-plugin registration.
The Rust compile check passed; an interactive Tauri smoke test was not run.

README component references and AGENTS' plugin list were updated. No later
architecture steps, dependency upgrades or unrelated formatting changes were
included. These changes are left uncommitted for review.
