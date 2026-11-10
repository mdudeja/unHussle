# Trusted local extension SDK, version 1

This release provides in-process registration and disposal. It does not discover,
install, load, or sandbox plugins. Authors edit their TypeScript in their own tools.
Backend and frontend activate separately; a backend extension cannot use React,
and a frontend extension cannot access SQLite or filesystem transaction objects.

The supported authoring entry points are `src-db-server/extensions/sdk.ts` and
`src/extensions/sdk.ts`, plus TypeBox for schemas. These export contracts and
frontend query hooks, not application runtimes, repositories, Drizzle, or Zustand.
`common/extensions/host.ts` owns scopes and lifetimes, not command execution; it
is not a plugin import surface.

Each extension declares a lowercase namespace (`sample`) and `sdkVersion: 1`.
Every registration ID starts with that namespace (`sample.capture`). Built-in
namespaces are reserved. The host rejects collisions and unsupported versions.
Ordinary action/command/workflow and UI replacements require `{ override: true }`
and ownership of the same ID. Stale disposers cannot remove replacements. Atomic
commands use new IDs instead of replacement; their actions support explicit
owned replacement. Changing a required kernel action list or binding remains
forbidden. Ordinary definitions cannot inline workflows.

## Application wiring and single source of truth

Each application executor owns **one composition registry**. Mutation, scheduler,
vault, ordinary extension commands and atomic extension commands register their
real actions and definitions there. There is no builtin catalog, proxy command,
bridge action or per-extension compiler. Typed HTTP dispatch, extension invocation
and workflows resolve the same compiled plans.

| Module                                                 | Responsibility                                                                                           |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `common/workflows/composition.ts`                      | Actions, definitions, schema/binding validation, cached plans and execution boundaries                   |
| `common/workflows/runtime.ts`                          | Typed/dynamic invocation, command tracing and event subscriptions/publication                            |
| `src-db-server/workflows/kernel.ts`                    | Transaction, compensation and post-commit publication services                                           |
| Backend `registerMutations.ts` / `registerStateful.ts` | Register domain actions and built-in definitions once in that registry                                   |
| `common/extensions/host.ts`                            | Namespace/version/ownership checks and scoped disposal, delegating registration to the supplied registry |
| Backend/frontend `extensions/application.ts`           | Adapt supported application capabilities and UI contributions                                            |
| `src-db-server/bootstrap.ts` / `src/bootstrap.ts`      | Application composition roots: wire execution to extension adapters and own disposal                     |
| `examples/extensions/`                                 | Opt-in examples imported by integration tests, outside production source                                 |

The executors do not import or construct the extension host. Bootstrap creates
execution first and supplies its registry and invoker to the host adapter. On
shutdown it disposes extensions before execution. A standalone executor works
without activating an extension subsystem. The standalone shared runtime's
`commands.handle` convenience also registers a real action and definition in its
registry; application runtimes with an injected catalog reject this alternate
registration entry point.

An atomic boundary is kernel-owned registration metadata attached to a command,
not another handler or definition. Asynchronous invocation enters that boundary
once; compatible synchronous child plans inline into the same transaction. An
ordinary command cannot inline an atomic command, and an atomic command cannot
inline application actions or commands using another boundary. Use a workflow
for independent commits. Scheduler and vault state is command-specific and cannot
be reused by another command. Extensions cannot name private kernel actions such
as row persistence to omit integrity steps; they invoke public commands or the
supported synchronous domain facade.

Registration compiles and validates changes; invocation reuses cached plans.
Removing a provider revokes dependent plans in the same registry. Nested workflow
commands retain command spans and operation IDs without a second dispatch layer.

## Backend example

`examples/extensions/backend.ts` imports only the public SDK and TypeBox. It
registers a synchronous domain action, the atomic `sample.capture` command, an
asynchronous read action/command, and `sample.captureAndDescribe`, a workflow with
an explicit binding from the captured task ID to the read step. It also subscribes
to `tasks.add` and persists a namespaced timestamp setting.

Application bootstrap or a test opts in explicitly:

```ts
const remove = runtime.extensions.register(sampleBackendExtension)
// Activation receives api. That scope can invoke:
// await api.workflows.execute('sample.captureAndDescribe', 'Write the report')
remove()
```

The runtime object in this bootstrap example belongs to the application. Plugin
code receives only the scoped API in `activate(api)`.

- `api.actions.register` installs a schema-validated, optionally asynchronous
  operation. Its context is application services: `queries` and typed `execute`.
- `api.commands.register` compiles an ordered composition with input/output
  schemas, unique step IDs, explicit input bindings and a result binding. Nested
  definitions use the same compiler as built-ins. Use `api.commands.execute`
  to invoke registered commands by ID.
- `api.atomic.action` receives only synchronous `domain.mutations.apply` and
  `domain.mutations.get`. It never receives a transaction or repository. `apply`
  chooses the correct public mutation family and runs the entire protected
  kernel plan, including validation, tracking, relationships, counts and vault
  operations. File compensation and queued publication are shared with built-ins.
- `api.atomic.command` compiles actions for one SQLite transaction. Compatible
  atomic commands inline; promises or invalid outputs roll the transaction back.
  The domain capability expires when execution leaves that transaction. It cannot
  be retained and used for later writes. Scheduler/vault commands keep their
  specialized algorithms and execute through ordinary application services,
  rather than nesting independent transactions inside an atomic command.
- `api.workflows.register` compiles command-only steps. Each command completes
  independently, in order. `WorkflowFailure.completed` lists successful steps;
  `failedStep` identifies the failed step (or input/result validation). Earlier
  commits remain committed. Nothing retries writes automatically.

Ordinary asynchronous commands are orchestration, not an atomic boundary. If an
ordinary action performs a supported write, that write owns its own commit. Use
an atomic command for compatible entity changes that must roll back together;
use a workflow when separate command commits need explicit partial-failure data.

`services.queries` supplies bounded list reads, flat edit reads, reference pages,
container task pages and task context. It does not expose raw SQL or resource
content in entity projections. Dedicated content saves remain available through
supported commands. `services.execute` runs typed built-in entity, scheduler and
vault commands through their existing integrity boundaries. Extension and action
spans use IDs only; nested supported command execution carries trace metadata.

Backend settings live under `app_settings.settings.extensions[namespace]`; this
uses the existing JSON column and needs no migration. Values must be JSON data.
Vault settings and other extensions' settings are preserved. These preferences
survive disposal and later activation, which does not erase user data.

## Frontend example

`examples/extensions/frontend.tsx` registers an asynchronous command, a menu and a view.
`SampleTaskView.tsx` uses `useExtensionEntries('tasks')`, so its rows remain owned
by the query coordinator. Other supported hooks are `useExtensionDetail` and
`useExtensionSearch`. Imperative `services.queries` also uses that coordinator, returning detached
snapshots. Public query hooks expose read-only results; plugin edits belong in
local drafts and are saved through supported commands.

```ts
const remove = runtime.extensions.register(sampleFrontendExtension)
// The sidebar receives "Sample tasks", linking to /extensions/sample.tasks.
remove()
```

Views register `{ id, label, component }`. Menus register `{ id, label, viewId }`
or `{ id, label, run }`. Removing a view unmounts it even if its route is open;
removing menus updates the sidebar. Frontend settings use a namespaced localStorage
key, with an in-memory fallback when storage is unavailable. They are UI settings,
not a backend settings mirror. The frontend exposes no transactional action API.

## Lifecycle and errors

Activation and cleanup callbacks are synchronous. Registration disposers,
subscriptions and `api.own(dispose)` resources share one scope. Disposal runs
cleanup in reverse order and continues if a cleanup throws. Failed activation
cleans up everything acquired so far and frees the namespace. Host disposal
removes all extensions, including their menu/view contributions and listeners.

Disposed scopes reject subsequent service calls and registration attempts.
Removing actions or commands revokes dependent definitions and compiled plans,
so old cached callbacks cannot keep executing or block unrelated registration.
A dependent definition must be registered again after its provider returns. Schema validation and recursion detection also
apply on explicit replacement; a failed replacement retains the valid plan.
Already-started asynchronous work is not cancelled or represented as rolled back.
Public event listeners are optional post-commit work; their errors cannot fail a
committed write. `api.log` prefixes the extension namespace; authors must keep
resource content and other user payloads out of logs and telemetry attributes.

Regression tests: `src-db-server/__tests__/extensions.test.ts`,
`src/__tests__/extensions.test.ts`, and the common composition compiler tests.
Plugin loading, installation, durable workflows, parallel execution, arbitrary
entity schemas, and an editor remain deferred.
