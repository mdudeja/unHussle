# Step 4: centralized task membership

Implements step 4 of `UnHussle_plan.md`. Step 5's projection/pagination changes
and all subsequent architecture work remain deferred. No migrations or
dependency changes were made.

## Membership rules

| Container | Task membership |
| --- | --- |
| Project | Directly assigned tasks |
| Goal | Direct tasks and tasks assigned to its projects |
| Area | Direct tasks and tasks from its projects, goals and those goals' projects |
| Tag or URL | Directly attached tasks and tasks in attached collections and their descendants |

`database/repositories/taskMembership.ts` implements this fixed hierarchy with
SQL predicates and subqueries. Predicates select each task once, even when
several paths match. Hydrated task reads, membership counts and batched
collection membership all use these predicates.

Every collection read method (`getAll`, `getPaginated`, `getById`, `search`,
`getByIds`) now returns the same membership for a given collection. A batch
query resolves the task arrays for the whole collection page. The old upward
merging helper and the shallow task-query helper are removed.

Projects no longer acquire their parents' tasks. Goals no longer acquire their
parent area's tasks. Moving a project or goal changes membership on the next
read; no membership cache or additional storage was introduced.

Upward context inheritance is unchanged. Nested collection lists and editable
resource/tag/URL attachments remain direct-only. A task may inherit a resource
from a goal without that resource becoming a direct project or task link.

## Counts and supporter reads

Persisted `count_tasks` retains its original meaning: directly assigned tasks
for collections, directly attached tasks for supporters. It is not a resolved
membership total.

Root collection reads now include read-only `resolved_task_total`. It equals
the returned membership array's length. The field is stripped from writes along
with other derived counts; there is no database column for it.

`SupporterItemsRepository` replaces tag-specific orchestration in the route and
serves both `GET /tags/:id/items` and the new `GET /urls/:id/items`. Responses
retain the existing task/collection arrays and add:

```ts
{
  tasks, projects, areas, goals,
  resources,              // directly attached resources only
  resolved_task_total,    // resolved task count using the shared predicate
}
```

Collection/resource arrays contain only direct attachments to the supporter.
Only task membership expands downward. A supporter attached to a resource
returns that resource but does not traverse resource backlinks to discover
tasks. Resource content stays outside these responses.

The frontend shares its supporter query/panel for tags and URLs, displays the
resolved task count and shows directly attached resources. Existing HTTP paths
and the existing collection/task response structure remain in place; no cursor
pagination, selectors or replacement read models were introduced.

## Verification

- Typecheck, lint, production build and `git diff --check`: pass.
- Full suite: **396 tests pass, 0 fail; 1,267 assertions** across 39 files.
- Existing tests that asserted upward merging now assert containment.
- New repository tests cover all collection entry points, both supporter kinds,
  project-only/goal-only attachments, cross-parent paths, duplicate paths,
  reparenting, empty/unknown memberships, direct versus resolved counts,
  read-only totals, editable attachments and context inheritance.
- New HTTP tests cover both supporter endpoints, totals surviving response
  validation, direct resource results, reparenting and 404 responses.

The [recorded baseline](baselines/step-4.json) uses the original fixture:

| Read | Previous task count | Step 4 task count | Direct `count_tasks` | Resolved total |
| --- | --- | --- | --- | --- |
| Project | 4 | 2 | 2 | 2 |
| Goal | 6 | 5 | 2 | 5 |
| Area | 6 | 6 | 2 | 6 |
| Tag items | 3 | 6 | On the supporter row | 6 |

The ordinary task-edit workload still performs four HTTP requests and returns
15,836 decoded response bytes per command, with no duplicate GETs or telemetry
signals. Median latency was 10.19 ms in this five-sample run; this is not evidence
of a performance change. Relationship response sizes change as membership is
corrected and totals are added. Existing indexes were retained; no speculative
indexes or generic graph framework were added.

## Existing namespace prerequisite

Before these edits, HEAD had seven stale references to `occurrence.transition`
and `tracking.stop` although the shared contracts and updated AGENTS already
used `scheduler.occurrence.transition` and `scheduler.tracking.stop`. This
prevented typecheck and scheduler execution. The stale names were aligned in
the scheduler routes, handler registry, HTTP client mapping and overnight dialog.
HTTP paths and scheduler algorithms did not change. The existing scheduler and
overnight regression tests pass with those references corrected.

The build retains the existing Vite large-chunk warning. An interactive Tauri
smoke test was not run. Changes are left uncommitted for review.
