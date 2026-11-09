---
title: Untitled
created: 2026-11-09 22:39
last_edited: NaN
cssclasses:
  - max
  - embed-strict
  - table-max
tags:
---
# unHussle: consolidated cleanup and architecture redesign plan

## Objective and boundaries

Simplify the codebase while establishing a foundation for user-customizable commands, workflows, and plugins.

Preserve existing features, local-first operation, and stored data. Correct relationship behavior to follow the clarified containment model. Deliver the work as small, independently reviewable PRs.

The immediate scope includes the execution architecture, relationship reads, frontend data ownership, shared forms, and cleanup. Plugin installation, plugin loading, and a visual workflow editor are later releases. Users author custom code in their own tools; an in-app code editor is unnecessary.

Do not use agentic-indexer until its index is repaired.

## Target architecture

| Component | Responsibility |
|---|---|
| Application kernel | Enforce validation, persistence, tracking, and commit integrity |
| Domain services | Implement task, collection, supporter, scheduler, and vault behavior |
| Action | One named operation with explicit inputs and outputs |
| Command | A validated composition of actions |
| Workflow | An ordered composition of commands |
| Read services | Resolve membership and assemble explicit response projections |
| Query coordinator | Own frontend server-derived data and refreshes |
| Zustand | Own UI state and local session presentation |
| Plugin API | Expose supported registration, queries, commands, events, and lifecycle |

Built-ins and future extensions use the same registration system. Domain algorithms remain ordinary typed code rather than becoming a large configurable workflow language.

## Step 1 — Establish a baseline

- Run typecheck, lint, the full test suite, and build before changing behavior. Typecheck and lint passed during planning; the full suite and build remain to be established.
- Record representative command latency, HTTP request counts, duplicate refreshes, response sizes, and relationship-query behavior.
- Create fixtures covering multiple collection paths and duplicate memberships.
- Separate existing failures from regressions introduced during the redesign.

**Completion check:** There is a reproducible baseline and a short list of existing failures, if any.

## Step 2 — Remove verified obsolete code

- Remove the unused older `TaskFormComponent`, its export, and the unmounted design-system component.
- Verify unused helpers and exports against source, tests, configuration, and dynamic registrations before removing them.
- Audit unused dependency candidates, including SQL/filesystem Tauri plugins, date utilities, UUID packages, and redundant direct dependencies. Check peer dependencies, Rust registration, and capabilities before removal.
- Do not update lockfiles manually. use `bun run tauri remove` to remove a tauri plugin and `bun remove` to remove bun/node_modules packages.
- Remove stale documentation references.
- Avoid unrelated formatting churn.

**Completion check:** Removed code has no consumers; application behavior and checks remain unchanged.

## Step 3 — Establish domain and contract boundaries

- Separate public command/event contracts from backend transaction and action-execution types.
- Move authoritative task transitions and tracking coordination into backend domain services.
- Keep overnight prompts on the frontend; send the resolved user choice to the backend.
- Keep collection integrity, supporter synchronization, derived counts, and vault consistency behind domain services used by every command.
- Separate runtime enum imports from schema-derived type imports. Remove confirmed dependency cycles without duplicating schemas.
- Keep the scheduler engine pure and its hard constraints separate from preference rules.

**Completion check:** HTTP routes, built-in commands, and future extensions all reach the same integrity-enforcing operations.

## Step 4 — Centralize relationship membership

Implement a task-membership read layer with these rules:

| Requested container | Included tasks |
|---|---|
| Project | Tasks directly assigned to the project |
| Goal | Direct tasks and tasks assigned to its projects |
| Area | Direct tasks and tasks reached through its projects, goals, and those goals’ projects |
| Tag or URL | Directly attached tasks and tasks belonging to attached collections and their descendants |

- Deduplicate by task ID across all matching paths.
- Remove upward task merging: a project must not acquire its parent area’s or goal’s other tasks.
- Keep upward inheritance of task context separate from downward collection membership.
- Share membership predicates between task retrieval and total counts.
- Distinguish direct attachment counts from resolved task totals explicitly.
- Move supporter-read orchestration out of routes and reuse it for tags and URLs.

Use SQL predicates, `EXISTS`, or unions for the current fixed hierarchy. Do not introduce a generic graph framework.

**Completion check:** Collection and supporter reads return the same membership regardless of which frontend view requested them.

## Step 5 — Replace broad hydration with explicit read models

Change the read process to:

```text
Resolve membership
    → filter, order, and paginate
    → fetch the required projection
    → assemble the response
```

- Standard collection/supporter detail reads include the container, direct relations, and a page of resolved tasks with a total and continuation information.
- Provide lightweight reference reads for selectors and autocomplete.
- Keep direct editable attachments distinct from derived membership and inherited context.
- Return reference labels and presentation metadata needed by badges without requiring unrelated lists to be loaded.
- Batch relation fetching where necessary; avoid per-row hydration requests.
- Retain useful junction-unwrapping helpers and specialized scheduler projections.
- Keep resource content outside entity responses, events, and telemetry.

Suggested response structure:

```ts
{
  item,
  directRelations,
  tasks: {
    items,
    total,
    nextCursor,
  },
}
```

Migrate consumers through temporary adapters where needed, then remove obsolete hydrated shapes and merging helpers.

**Completion check:** No collection task set is assembled by fetching nested object trees and merging their task arrays.

## Step 6 — Introduce validated command composition

Add separate registries for executable actions and serializable command definitions.

Each definition has:

- A stable namespaced ID and description.
- Runtime input and output schemas.
- Ordered steps with unique IDs.
- Explicit input bindings and references to prior step outputs.
- An explicit result binding.

Compile definitions when registered or changed:

- Resolve references and validate bindings.
- Reject missing actions, duplicate IDs, incompatible definitions, and recursion.
- Enforce mandatory steps and ordering constraints.
- Preserve a valid requested order; explain invalid configurations rather than silently rearranging them.
- Cache the compiled execution plan.

Replace implicit `carryForward`, last-result conventions, and runtime nested-handler expansion incrementally. Preserve typed built-in command interfaces; confine dynamic type erasure to the registry boundary.

**Completion check:** Built-in commands execute through validated definitions, and missing steps cannot be silently skipped.

## Step 7 — Unify execution while protecting integrity

Use three execution boundaries:

1. **Preparation:** asynchronous input preparation and reads.
2. **Atomic execution:** synchronous domain actions in one SQLite transaction.
3. **Completion:** committed events followed by optional asynchronous effects.

- Required validation, tracking, relationship integrity, and publication rules remain kernel-owned.
- Users may reorder exposed actions only where dependencies permit.
- Atomic compositions inline compatible actions rather than opening nested transactions.
- Preserve vault compensation on rollback and cleanup after commit.
- Preserve tracing, operation IDs, and the distinction between write failure and post-commit refresh failure.
- Keep complex scheduler and vault algorithms inside domain operations.

For workflows combining commands:

- Execute sequentially.
- Commit each command independently.
- Stop on failure and identify completed steps and the failing step.
- Never imply earlier committed commands were rolled back.
- Do not retry writes automatically.

**Completion check:** Custom composition cannot bypass supported integrity guarantees or create ambiguous transaction behavior.

## Step 8 — Simplify frontend command transport

- Share operation registration, stream readiness, HTTP execution, event settlement, timeout recovery, and cleanup.
- Register expected events before sending the request.
- Preserve task lifecycle serialization and per-resource save ordering.
- Replace repeated service singleton classes with configured service instances; retain specialized operations as small adapters.
- Use one API address helper with the documented port `3456` default across all clients.
- Preserve existing HTTP paths and event contracts during migration.

**Completion check:** CRUD, scheduler, and vault commands share transport mechanics without losing domain-specific behavior.

## Step 9 — Give the query coordinator sole ownership of server data

- Migrate lists, details, searches, related content, and context panels to query results.
- Remove duplicate entity data ownership in Zustand.
- Replace manual row-projection reactions with query invalidation driven by committed changes.
- Deduplicate affected dependencies at operation boundaries.
- Include membership changes in invalidation, such as moving projects between goals or areas.
- Preserve request deduplication, obsolete-response protection, mounted-query refreshes, and independent list/search membership.
- Keep Zustand for UI state, dialog state, and local session presentation.
- Make relation badges independent of which paginated lists happen to be loaded.

Use the existing query coordinator rather than adding another state-management dependency.

**Completion check:** Each server-derived result has one frontend owner, and future views can consume the same domain read models.

## Step 10 — Consolidate entity forms

- Replace repeated create-button implementations with a shared creation component backed by the entity registry.
- Share field builders and transformations across creation and editing.
- Keep creation defaults separate from edit defaults.
- Preserve resource creation’s navigation to its editor and server-error display.
- Load selector options only while needed.
- Preserve drafts during background refreshes.
- Submit direct editable attachments only; never save inherited or computed membership as new links.
- Correct copied labels and error messages.

**Completion check:** Entity-specific configuration remains concise, while shared submission and dialog behavior live in one implementation.

## Step 11 — Prove the future plugin API

Target trusted local plugins with separate backend and frontend contexts.

Expose:

- Action, command, and workflow registration.
- Supported domain queries and command execution.
- Public event subscriptions.
- Namespaced settings and logging.
- Frontend menu/view contributions.
- Lifecycle-owned disposable registrations and subscriptions.

Do not expose raw Drizzle transactions, mutable runtime objects, or Zustand internals as the supported SDK. Transactional actions receive a synchronous domain context; ordinary actions use asynchronous application services.

- Require namespaced IDs and an SDK version.
- Reject registration collisions; make overrides explicit.
- Verify disposal removes contributed behavior.
- Add an in-process sample extension using the same registration entry point as built-ins.
- Document authoring and execution context with examples.

**Completion check:** A sample extension can register, invoke, compose, and dispose its behavior without importing application internals.

## Step 12 — Complete verification and documentation

- Replace the test runner’s fixed startup sleep with bounded health polling and startup-failure detection.
- Preserve test exit status and clean up only the server started by the runner.
- Update README and AGENTS instructions for the final architecture.
- Document retained workarounds and the regression tests protecting them.
- Remove temporary adapters after all consumers migrate.
- Repeat baseline measurements and report actual efficiency changes.

Required regression coverage:

- Direct and descendant membership, multiple paths, deduplication, and exclusion of parent/sibling tasks.
- Supporter attachment to nested collections and matching task totals.
- Form round-trips without accidental inherited links.
- Transaction rollback, vault compensation, tracking exclusivity, and scheduler conflicts.
- Invalid compositions, action ordering, recursive definitions, and workflow partial failure.
- Early events, missing events, failed refreshes, queue recovery, and plugin disposal.
- Query invalidation, stale-response protection, and draft stability.

Finish with the full suite, build, and a Tauri smoke test covering startup, CRUD, scheduling, tracking, resource editing, and file operations.

## Defaults and deferred work

- Keep WebKit’s EventSource transport, Bun’s fetch transport, SSE replay/resync, event-timeout recovery, vault conflict handling, and backward-compatible settings defaults.
- Keep existing relationship storage initially; add indexes only where query plans and measurements justify them.
- For the foundation, a supporter attached to a resource returns that resource but does not traverse backward through resource links to discover tasks. Treat any future resource-backlink traversal as an explicit additional rule.
- Defer plugin loading/installation, a visual workflow editor, durable workflows, crash resume, parallel execution, marketplace support, and arbitrary plugin-defined entity schemas.
- Do not introduce a universal repository, general graph engine, replacement state framework, or security-sandbox promise.

The implementation is complete when built-ins use the extensible composition model, relationship reads follow containment consistently, server data has one frontend owner, and the baseline checks and workflows pass.
󰾆