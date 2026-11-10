# Step 5: explicit read models

Implements only step 5 of `UnHussle_plan.md`. Command composition, execution,
transport consolidation, Zustand migration, form consolidation and plugins
remain deferred. No database migration or dependency change was needed.

## Reads and consumers

- `GET /projects/:id/detail`, `/goals/:id/detail`, `/areas/:id/detail`,
  `/tags/:id/detail`, and `/urls/:id/detail` return
  `{ item, directRelations, tasks: { items, total, nextCursor } }`.
- Tag/URL `/:id/items` paths also return this explicit detail shape. The old
  flat supporter response and collection `tasks` arrays have been removed;
  all in-repository consumers and assertions use the new model.
- `GET /:kind/:id` remains the direct edit projection used by existing CRUD
  transport and forms. It contains no descendant task membership. Task edit
  reads retain their own interval history and direct attachments.
- List/search reads use their table projections. Collection parent references
  contain label/icon/color; collection lists omit nested collections, resource
  arrays and URLs. Task tables omit URLs, resources, anchors and closed timer
  history. Open intervals are fetched once per batch for lifecycle presentation.
- Resource-link owner queries select only ID/title. Resource file content
  remains exclusively on its dedicated content endpoint.

`ReadModelsRepository` uses the existing fixed hierarchy predicate to resolve
membership, apply filters/order and select a bounded page of IDs before
fetching the task projection. Totals count the filtered membership before the
cursor. Task rows appear once, including when multiple containment paths match.
`withCollectionTotals` counts resolved membership for a collection page without
fetching its tasks. The unlimited `getByMembership` hydration path is removed.

Task pages default to 20 and cap at 100. They support `q`, `status`, `priority`,
`is_fun`, `is_chore`, `is_quick`, `sort`, `direction`, and `cursor`. Ordering has
an ID tie-breaker, handles null values, and preserves the table's enum order
for status and priority. Cursors include the container, filters, ordering and
last position; incompatible or malformed task cursors return 400. Invalid HTTP
query values return 422. Continuation reflects live data, not a frozen snapshot
across requests; concurrent edits can change membership or ordering.

Related panels use server search, filters, sorting and Previous/Next controls.
Direct supporter collection/resource tables retain their presentation and local
filters. Direct attachments and upward task context remain distinct from the
resolved task page, so forms never submit inherited links as new attachments.

## Reference reads

`GET /:kind/references` returns `{ items, total, nextCursor }`. Rows contain
ID/title, collection icon/color and direct tag labels; they exclude descriptions,
custom data, entity trees, timer history and resource content. `q` matches titles
or direct tag titles. `ids` is a comma-separated selected-ID filter. Reference
pages are ordered by ID, default to 50 and cap at 100.

Create/edit selects, attachment search, task anchors, tag inputs, brain dump
parsing and hashtag autocomplete now use references. Plain selects follow
continuations while mounted rather than depending on the first loaded entity
page. Reference data lives in the existing query coordinator. Entity badges
render metadata supplied by their row, independently of paginated Zustand lists.
Other list ownership and mutation reactions remain as before for step 9.

Elysia's `UnionEnum` inserts its first value as a default for optional query
fields. Read query schemas use string patterns where necessary to preserve
omitted flag filters. The HTTP regression checks omitted filters explicitly.

## Verification and measurements

- Typecheck and lint pass.
- Full test suite: 400 tests pass across 39 files.
- Production build, including sidecar compilation, passes. Vite retains its
  existing large-chunk warning.
- Coverage includes collection/supporter containment, reference payloads and
  tag search, complete cursor traversal, totals, filtering before limits,
  incompatible cursors, HTTP defaults/validation, enum ordering, open tracking
  intervals versus edit history, direct attachments and content exclusion.
- Tauri/browser interaction smoke testing remains for step 12; these checks
  exercise the API, repositories, workflows and build.

The reproducible temporary-database benchmark is recorded in
[`baselines/step-5.json`](baselines/step-5.json). Compared with step 4, the
representative task edit remains four requests, with decoded JSON decreasing
from 15,836 to 12,519 bytes (20.9%). The five-sample median changed from 10.19 ms
to 7.03 ms; these local timings are observations, not a performance guarantee.
The tag detail response decreases from 14,225 to 6,307 bytes. Small collection
detail responses grow because task rows now include the reference labels needed
by their tables plus explicit direct relations and page metadata. Their task
payload is bounded by page size rather than total descendant count.
