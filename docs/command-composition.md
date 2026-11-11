# Command composition

For maintainers. This covers the composition registry in
`common/workflows/composition.ts`: how commands are defined, checked,
compiled and run.

- The runtime around it (transactions, events, reactions, queries) is in
  [workflows.md](workflows.md).
- Extension authors should start with [extensions.md](extensions.md).

## The idea

Every command is data: a **definition** that lists steps. Each step calls a
named **action** (a function) or another command. The registry checks the
whole definition when it is registered, and turns it into a cached
**plan**. Running a command runs its plan. Nothing is interpreted at call
time.

Each side has one registry, and everything registers there:

| Side     | Registry created in                 | Who registers                                               |
| -------- | ----------------------------------- | ----------------------------------------------------------- |
| Backend  | `src-db-server/workflows/kernel.ts` | mutation, scheduler and vault built-ins; backend extensions |
| Frontend | `src/workflows/execution.ts`        | frontend commands (one-step handlers); frontend extensions  |

The HTTP routes, `runtime.commands.execute`, nested steps and extensions all
resolve to the same plans. There is no second catalog and there are no proxy
commands.

## Definitions

```ts
type CommandDefinition = {
  id: string // namespaced: 'entity.add', 'sample.capture'
  description: string
  execution?: 'command' | 'workflow'
  input: TSchema // TypeBox
  output: TSchema
  steps: { id: string; action?: string; command?: string; input: Binding }[]
  result: Binding
}
```

- Each step names exactly one `action` or `command`.
- Step IDs are unique within a definition.
- Definitions hold no functions, so they can be serialized. Registration
  restores TypeBox metadata for plain JSON-schema input. That covers
  objects, arrays, records, unions, intersections, literals, enums and
  primitives. `$ref`, `oneOf` and `not` are rejected rather than read as
  `unknown`.
- The registry clones what it stores, so later edits to the caller's object
  have no effect. `registry.definition(id)` also returns a copy.

### Actions

```ts
type ActionDefinition<C> = {
  id: string
  description: string
  input: TSchema
  output: TSchema
  execution?: 'atomic' | 'application'
  run: (input: unknown, context: C) => unknown
}
```

`C` is the side's execution context. On the backend it carries `trace`,
`transaction`, `actionContext`, `state` and `domain`. On the frontend it is
`{ trace }`.

| `execution`   | Allowed in                       | Typical use                                  |
| ------------- | -------------------------------- | -------------------------------------------- |
| `atomic`      | Commands with a boundary only    | Extension atomic actions                     |
| `application` | Commands without a boundary only | Extension actions (may be async)             |
| not set       | Anywhere                         | Kernel actions; they check their own context |

### Bindings

A binding says where a step's input, or the result, comes from:

| Binding                         | Value                                  |
| ------------------------------- | -------------------------------------- |
| `{ from: 'input', path? }`      | The command input, or a property of it |
| `{ from: 'step', step, path? }` | An earlier step's output               |
| `{ from: 'literal', value }`    | A fixed value                          |
| `{ from: 'object', fields }`    | An object built from other bindings    |

A `path` may only name properties declared in the schema. If any segment
on the way is optional, the binding may be `undefined`, so it cannot feed a
required input.

## What registration checks

`registerCommand` compiles **every** definition again, so a change that
breaks a dependent fails right away. A definition is rejected for:

- a missing action or command, or a recursive command chain
- a duplicate or empty step ID, or a step with both or neither of `action`
  and `command`
- a reference to the current or a later step
- a path to an undeclared property
- an incompatible binding: the source schema must be JSON-equal to the
  target, or assignable under `Type.Extends`. This applies to every step
  input and to the result against `output`.
- an execution-boundary mismatch (see below)
- an ordinary command that inlines a workflow
- a policy violation (see below)
- an ID without a namespace (`a.b`), or a duplicate ID

A failed `registerCommand` removes what it added and recompiles, so the
registry stays as it was. `replaceCommand` restores the previous
definition when the replacement fails.

## Plans

A plan has two entry points:

- `run`: synchronous, used inside a transaction
- `runAsync`: used for everything else

Both validate the command input, each step's input and output, and the
result, against their schemas.

| Situation                                 | What happens                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Command without a boundary                | `runAsync` awaits each step. A command step runs that command's own `runAsync`.                  |
| Command with a boundary                   | `runAsync` validates input, then calls `boundary.run`, which runs the plan synchronously inside. |
| Command step inside a boundary            | Its plan is inlined into the same synchronous run and transaction.                               |
| Any step returning a promise inside `run` | Rejected: "Atomic actions must be synchronous".                                                  |
| Workflow                                  | `runAsync` only (`run` throws). Each command step runs on its own; see Workflows.                |

Nested command steps get their own `command` span through the registry's
`invokeCommand` hook (`commandTracing` in `common/workflows/registration.ts`).

## Execution boundaries

A **boundary** wraps a command's synchronous plan with the work that
cannot live in a plan:

- opening the transaction
- collecting events and side effects
- publishing after commit

A command has at most one boundary, attached when it is registered.

```ts
type CommandBoundary<C> = {
  id: string
  run: (
    input,
    context,
    execute: (context, input?) => unknown,
  ) => Promise<unknown>
}
```

| Boundary ID           | Owner                  | Commands                                              |
| --------------------- | ---------------------- | ----------------------------------------------------- |
| `mutation`            | `registerMutations.ts` | `entity.*`, `entityCollection.*`, `entitySupporter.*` |
| `scheduler.<command>` | `registerStateful.ts`  | each scheduler command                                |
| `vault.<command>`     | `registerStateful.ts`  | each vault command                                    |
| `extension.atomic`    | `domainBoundary.ts`    | extension atomic commands                             |
| none                  |                        | frontend commands, extension commands, workflows      |

Rule: an ordinary (non-workflow) command may only use command steps with
the **same** boundary ID. So:

- Commands without a boundary compose freely.
- Mutation commands share an ID, but their policy allows one row operation,
  so in practice they don't inline each other.
- Scheduler and vault commands cannot inline anything, because each has
  its own boundary ID.
- Extension atomic commands inline only other extension atomic commands.
  They reach built-in mutations through `domain.mutations.apply`, which
  runs the mutation plan synchronously inside the extension's transaction.

Running the steps of different boundaries in sequence is what workflows
are for.

## Policies

A built-in definition can carry a `CompositionPolicy` when registered:

- `required`: action IDs that must appear in this order in the
  **flattened** action list, after inlining. Other actions may sit between
  them.
- `protectBindings`: the original definition is kept. Any later
  replacement must keep these unchanged:
  - `execution`, `input`, `output` and `result`
  - every original step, exactly once
  - exactly one row operation (`createRow`, `updateRow`, `deleteRow`,
    `deleteAllRows`)

Mutation commands use both. Scheduler and vault commands use `required`.
This is what stops anyone, including extensions, from dropping or
reordering integrity steps such as validation, tracking or counts.

## Workflows

A definition with `execution: 'workflow'` runs its command steps one after
another with `runAsync`. Each step enters its own boundary, so it commits
on its own.

- On failure it throws `WorkflowFailure` with:
  - `failedStep`: the step ID, or `'input'` or `'result'`
  - `completed`: the `{ id, result }` of each step that finished
  - `cause`: the original error
- Later steps do not run. Nothing is rolled back or retried.
- Ordinary commands cannot inline a workflow. The registry allows a
  workflow step to be another workflow, but the extension host does not.

## Registry API

| Method                                            | Purpose                                                                                              |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `registerAction(action)`                          | Add an action. Its ID must be namespaced and unused.                                                 |
| `registerCommand(definition, policy?, boundary?)` | Add a command and recompile everything.                                                              |
| `replaceCommand(definition)`                      | Swap a definition; the previous one stays if the new one fails.                                      |
| `remove(actionIds?, commandIds?)`                 | Remove them, plus every command that depends on them, at any depth. Returns the removed command IDs. |
| `execute(id, input, context)`                     | Run synchronously (inside a boundary).                                                               |
| `executeAsync(id, input, context)`                | Run normally.                                                                                        |
| `kind(id)`                                        | `'command'`, `'workflow'` or `undefined`.                                                            |
| `boundary(id)`                                    | The command's boundary ID, if any.                                                                   |
| `definition(id)`                                  | A copy of the stored definition.                                                                     |
| `clear()`                                         | Drop everything (runtime disposal).                                                                  |

`registerCommandHandler(registry, id, run)` in
`common/workflows/registration.ts` registers a leaf command: one
`kernel.handler.<id>` action wrapped in a one-step command. Frontend
commands are registered this way.

## How built-ins are defined

**Mutations** (`src-db-server/workflows/composition.ts`)

- `mutationDefinition(id, actions)` turns an ordered action list from
  `commandHandlers.ts` into a definition:
  - Steps before the row operation take the command input.
  - Steps after it take the row step's output `input`, which `rowOutput`
    fills with the affected `id`, `ids` or `attachedIds`.
  - The result is the row step's `result`.

**Scheduler and vault** (`registerStateCommands`)

- Their actions pass an opaque envelope and work on a typed `state` that
  the boundary creates.
- An action can set `state.done` to skip the rest.
- A final `kernel.<namespace>.result.<command>` action returns
  `state.result`, validated against the command's output schema in
  `stateCommandSchemas`.

## Tests

| Covers                                                                                                                                     | File                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| Bindings, caching, inlining, serialized schemas, every rejection, replacement recovery, required order, sync enforcement, workflow failure | `common/__tests__/composition.test.ts`        |
| Kernel policies: missing or reordered integrity steps, changed bindings, duplicate row writes; workflow partial commits                    | `src-db-server/__tests__/composition.test.ts` |
| Boundaries and extension compositions                                                                                                      | `src-db-server/__tests__/extensions.test.ts`  |
