# Step 3: domain and contract boundaries

This implements step 3 of `UnHussle_plan.md`, following the baseline at commit
`68dbe04`. Relationship containment, read models, command compilation, transport
consolidation, query ownership, forms and the plugin SDK remain later steps.

## Contracts and dependencies

- `common/workflows/contracts.ts` contains public mutation commands and events.
  Commands use the three mutation families. Per-kind names (`tasks.change`,
  etc.) are events. Raw `entry.*` handlers are backend-only expansion templates
  and are no longer independently executable commands.
- `src-db-server/workflows/contracts.ts` owns action names, handler templates,
  transaction work units, transaction context and queued publication/compensation
  types. The frontend and shared public workflow contracts do not import them.
- `common/types/enums.ts` owns `ProgressStatus`, `Priority` and `AnchorType`.
  Runtime consumers import it directly; schema-derived types use `import type`.
  The existing types barrel re-exports enums for compatibility, with type-only
  exports for schema-derived shapes. There is still one authoritative schema.

The former runtime dependency from schema enum defaults back through the shared
types barrel is removed. Transpiling all modules in `common/types`,
`common/workflows` and `common/scheduler` found no emitted backend imports.
Type relationships may still refer to Drizzle-derived types; they are erased.

## Domain services

Synchronous integrity behavior lives under `src-db-server/domain/`:

| Module | Responsibility |
| --- | --- |
| `entries.ts` | Row persistence, normalization, server-owned field protection |
| `tasks.ts` | Stored-task validation, lifecycle stamps, occurrence transitions, chosen stop-time validation and task announcements |
| `tracking.ts` | Exclusive intervals, totals, pausing competing work and saved-plan membership |
| `collections.ts` | Resolve affected members before SQLite nulls their foreign keys |
| `supporters.ts`, `counts.ts` | Supporter synchronization, junction cleanup and derived counts |
| `resourceLinks.ts`, `resourceFiles.ts` | Link synchronization, announcements and compensated vault file operations |
| `vault.ts` | Content conflicts/saves, rescans, folder validation/moves and vault info |
| `scheduleMaintenance.ts` | Plan staleness and membership maintenance |

Mutation actions delegate to these services inside the existing unit of work.
Scheduler actions use the same tracking services for occurrences, breaks and
overnight corrections. The pure scheduler engine and its preference rules are
unchanged. Vault commands delegate to domain functions and retain their existing
compensated transaction boundary; resource creation, renaming and deletion use
the extracted file services. Vault execution state is backend-only as well.

Routes continue to execute public backend commands and hydrate committed rows.
The backend rejects mutation requests whose family or action does not match the
kind and command verb. Supported callers must use public commands, not raw row
helpers or transactions. Compiled definitions and mandatory composition steps
will be introduced in steps 6 and 7; no extension SDK is claimed here.

## Tracking behavior

The frontend no longer pauses a task before starting another task, an occurrence
or a break. It sends the requested command once. The backend closes competing
intervals and pauses their tasks/occurrences inside that same transaction.
Any later action failure rolls back the requested start and those pauses.

Competing task changes also update saved plan membership and queue committed
announcements. Dependent announcements are emitted before family/kind or
scheduler completion events, so SSE clients refresh those rows before command
settlement. The mutation event shapes, HTTP paths, operation IDs and tracing
remain compatible. This ordering change is intentional and covered by tests.

Frontend lifecycle serialization and local timer presentation remain. Committed
task and scheduler events reconcile an existing timer against persisted task
state; a failed start leaves its previous session intact. A timer refresh failure
shows a warning whose Retry repeats the read only. A no-op break does not clear
a session the backend still considers running.

Overnight prompts stay in the frontend. Their resolved time still goes to
`tracking.stop`, which validates it against the open interval and current time.
The existing optional follow-up Complete/Cancel command remains a separate
commit; this step does not introduce atomic multi-command workflows.

## Verification

Completed checks:

- `bun run typecheck` and `bun run lint`: pass.
- `bun run test`: **380 pass, 0 fail, 1,102 assertions** across 37 files.
- `bun run build`: pass, with the existing Vite large-chunk warning.
- `bun run baseline /tmp/unhussle-step3-baseline.json`: pass.
- `git diff --check`: pass.

The 13 additional tests cover direct command validation, private row templates,
family mismatch rejection, exclusive tracking in both directions between
one-offs and occurrences, saved membership, rollback after tracking, rejected
starts/breaks, committed pause announcements, missing events, no-op breaks and
read-only timer recovery. Existing tests still cover overnight stop bounds,
vault compensation, supporter/count integrity and scheduler conflicts.

The [baseline sample](baselines/step-3.json) has the same four HTTP requests,
15,836 decoded response bytes per ordinary edit, no duplicate GETs or telemetry
signals, and exactly the same relationship results/counts/sizes as step 2.
Median latency was 12.77 ms in this run (step 2: 10.51 ms); five samples under
concurrent verification do not establish a performance change.

No data migrations or dependency changes were made. An interactive Tauri smoke
test was not run. Changes are left uncommitted for review.
