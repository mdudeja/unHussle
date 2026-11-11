# Writing extensions

An extension adds commands, workflows, sidebar menus and pages to unHussle.
It is a folder of TypeScript that the app loads from your extensions folder.

Extensions run inside the app with full access to your data. They are not
sandboxed. A new extension stays off until the user turns it on in
**Preferences > Extensions**.

How the host works inside is covered in
[extensions-architecture.md](extensions-architecture.md).

## Quick start

1. Find the extensions folder. It is shown in **Preferences > Extensions**.
   By default it is the `extensions` folder next to the database folder. A folder
   chosen with **Choose another folder** comes first, then the
   `EXTENSIONS_DIR` environment variable, then the default.
2. Create a folder for your extension, such as `hello/`.
3. Add `hello/extension.json`:

   ```json
   {
     "id": "hello",
     "name": "Hello",
     "version": "1.0.0",
     "description": "Says hello.",
     "frontend": "frontend.tsx"
   }
   ```

4. Add `hello/frontend.tsx`:

   ```tsx
   import type { FrontendExtension } from 'unhussle/frontend'

   function HelloView() {
     return <h1>Hello</h1>
   }

   const extension: FrontendExtension = {
     activate: (api) => {
       api.views.register({
         id: 'hello.view',
         label: 'Hello',
         component: HelloView,
       })
       api.menus.register({
         id: 'hello.menu',
         label: 'Hello',
         viewId: 'hello.view',
       })
     },
   }

   export default extension
   ```

5. In **Preferences > Extensions**, select **Rescan extensions**, then turn
   **Hello** on. A **Hello** item appears in the sidebar under Extensions.

After editing an extension's files, select **Rescan extensions** to load the
new code.

## The manifest

`extension.json` describes the extension. Unknown fields are rejected.

| Field         | Required | Meaning                                                                                                                                            |
| ------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | Yes      | Namespace for everything the extension registers. Lowercase letters, digits, `-`, `_`; starts with a letter. `kernel` and `unhussle` are reserved. |
| `name`        | Yes      | Shown in Preferences.                                                                                                                              |
| `version`     | Yes      | Shown in Preferences.                                                                                                                              |
| `description` | No       | Shown in Preferences.                                                                                                                              |
| `backend`     | No       | Path to the backend entry, relative to the folder. Runs in the database server.                                                                    |
| `frontend`    | No       | Path to the frontend entry, relative to the folder. Runs in the app window.                                                                        |

Each entry default-exports `{ activate }`. Entries cannot point outside the
extension folder.

## Imports

The host bundles each entry, so an extension needs no `node_modules`. These
imports come from the app itself:

| Import              | Backend | Frontend |
| ------------------- | ------- | -------- |
| `unhussle/backend`  | Types   |          |
| `unhussle/frontend` |         | Yes      |
| `@sinclair/typebox` | Yes     | Yes      |
| `react`             |         | Yes      |
| `react/jsx-runtime` |         | Yes      |

Relative imports between your own files work as usual. Anything else must
be a package that the bundler can resolve from your folder.

## Concepts

Everything you register is named `<your id>.<name>`, such as `hello.greet`.

| You need                                              | Use                               |
| ----------------------------------------------------- | --------------------------------- |
| One piece of logic (it can read data or run commands) | An action inside a command        |
| Several entity changes that succeed or fail together  | An atomic command (backend only)  |
| Several commands in order, each saving on its own     | A workflow                        |
| A reaction to something that happened                 | An event listener                 |
| A sidebar item or a page                              | A menu and a view (frontend only) |

### Actions and commands

An **action** is a function with TypeBox input and output schemas. A
**command** is what callers run: a list of steps that each call an action or
another command, with explicit input bindings and a result.

```ts
api.actions.register({
  id: 'hello.titleAction',
  description: 'Read a task title',
  input: Type.String(),
  output: Type.String(),
  run: async (id, services) => {
    const task = await services.queries.get('tasks', id)
    if (!task) throw new Error('Task not found')
    return String(task.title)
  },
})
api.commands.register({
  id: 'hello.title',
  description: 'Read a task title',
  input: Type.String(),
  output: Type.String(),
  steps: [
    { id: 'read', action: 'hello.titleAction', input: { from: 'input' } },
  ],
  result: { from: 'step', step: 'read' },
})
await api.commands.execute('hello.title', taskId)
```

A binding selects one of:

- the command input: `{ from: 'input', path?: [...] }`
- an earlier step's output: `{ from: 'step', step, path?: [...] }`
- a fixed value: `{ from: 'literal', value }`
- an object built from other bindings: `{ from: 'object', fields }`

Registration checks schemas, bindings and step order, and fails with a
message if anything does not fit.

A command may only call actions registered by extensions. Built-in work is
reached through built-in commands (such as `entity.add`) or
`services.execute`.

### Atomic commands (backend)

An atomic command runs in one database transaction. If any step throws,
returns a promise, or returns output that does not match its schema,
every change rolls back and no events are sent.

```ts
api.atomic.actions.register({
  id: 'hello.captureAction',
  description: 'Create a task',
  input: Type.String({ minLength: 1 }),
  output: Type.Object({ id: Type.String() }),
  run: (title, domain) => {
    const row = domain.mutations.apply({
      kind: 'tasks',
      action: 'create',
      changes: { title },
    })
    if (!row || Array.isArray(row)) throw new Error('Task was not created')
    return { id: row.id }
  },
})
api.atomic.commands.register({/* steps that call hello.captureAction */})
```

Atomic actions are synchronous. `domain.mutations.apply` runs the same checks
as built-in changes, and `domain.mutations.get` reads rows, including
uncommitted ones. The `domain` object stops working when the transaction
ends, so do not keep it. Atomic commands can include other atomic commands,
but not ordinary actions.

### Workflows

A workflow runs commands one after another. Each command saves on its own.
If a step fails, later steps do not run and earlier steps stay saved. The
error is a `WorkflowFailure`: `failedStep` names the failed step, and
`completed` lists the steps that finished. Nothing is retried.

```ts
api.workflows.register({
  id: 'hello.captureAndRead',
  description: 'Create a task, then read its title',
  input: Type.String({ minLength: 1 }),
  output: Type.String(),
  steps: [
    { id: 'capture', command: 'hello.capture', input: { from: 'input' } },
    {
      id: 'read',
      command: 'hello.title',
      input: { from: 'step', step: 'capture', path: ['id'] },
    },
  ],
  result: { from: 'step', step: 'read' },
})
```

### Events, settings and logs

```ts
api.events.on('tasks.add', async (payload) => {
  /* after the change is saved */
})
await api.settings.set('lastRun', Date.now())
const lastRun = await api.settings.get('lastRun')
api.log.info('Started')
```

- Listeners run after a change is saved. If one throws, the error is
  logged and the change still stands.
- Settings must be JSON values. Backend settings are saved in the
  database. Frontend settings are saved in the app window's local storage.
  They are separate, and both remain after the extension is turned off.
- Log lines are prefixed with your extension ID. Keep user content out of
  logs.

### Menus and views (frontend)

```ts
api.views.register({ id: 'hello.view', label: 'Hello', component: HelloView })
api.menus.register({ id: 'hello.menu', label: 'Hello', viewId: 'hello.view' })
api.menus.register({ id: 'hello.run', label: 'Say hello', run: async () => {} })
```

A menu either opens a view or runs a function. A view opens at
`/extensions/<view id>`. Inside a view, read data with these hooks from
`unhussle/frontend`: `useExtensionEntries(kind, page?)`,
`useExtensionDetail(kind, id)` and `useExtensionSearch(kind, term)`. Their
results are read-only. To change data, copy it into local state, then save
it through a command.

## API reference

### Both sides: `activate(api)`

| Member                                  | Purpose                                               |
| --------------------------------------- | ----------------------------------------------------- |
| `api.id`                                | Your extension ID                                     |
| `api.services`                          | The same `queries` and `execute` that actions receive |
| `api.actions.register(action)`          | Register an action                                    |
| `api.commands.register(definition)`     | Register a command                                    |
| `api.commands.execute(id, input)`       | Run any registered command or workflow                |
| `api.workflows.register(definition)`    | Register a workflow                                   |
| `api.events.on(name, listener)`         | Listen for an app event                               |
| `api.settings.get(key)` / `set(key, v)` | Read or save your settings                            |
| `api.log.info(msg)` / `error(msg, e)`   | Write to the app log                                  |
| `api.own(dispose)`                      | Run `dispose` when the extension is turned off        |

Each `register` and `on` call returns a function that undoes it.

### Backend only

| Member                                | Purpose                                         |
| ------------------------------------- | ----------------------------------------------- |
| `api.atomic.actions.register(action)` | Register a synchronous transactional action     |
| `api.atomic.commands.register(def)`   | Register a command that runs in one transaction |

### Frontend only

| Member                     | Purpose            |
| -------------------------- | ------------------ |
| `api.menus.register(menu)` | Add a sidebar item |
| `api.views.register(view)` | Add a page         |

### Services

| Member                                         | Returns                                                    |
| ---------------------------------------------- | ---------------------------------------------------------- |
| `queries.list(kind, page?, limit?)`            | One page of entries (at most 100)                          |
| `queries.get(kind, id)`                        | One entry, or `null`                                       |
| `queries.references(kind, { q, ids, cursor })` | A page of `{ id, title }` references                       |
| `queries.container(kind, id, options?)`        | A project, area, goal, tag or URL with a page of its tasks |
| `queries.taskContext(id)`                      | A task with its related entries                            |
| `execute(id, input)`                           | Runs a built-in command, fully typed                       |

`kind` is one of `tasks`, `projects`, `goals`, `areas`, `resources`, `tags`,
`urls` or `time_entries`. Frontend query results are copies, so changing
them has no effect on the app.

## Rules

- `activate` must be synchronous. Start async work inside it, and register
  its cleanup with `api.own`.
- Every ID you register starts with `<your id>.`. Registering an ID twice
  fails. To replace a registration, call its undo function first.
- Extension commands cannot call the app's private actions. Use built-in
  commands instead.
- `domain.mutations.apply` drops resource file content, and events never
  carry it. Save content through the built-in resource commands.

## Lifecycle and errors

- **Turning on** activates the backend entry, then the app window loads the
  frontend entry.
- **Turning off, or a rescan,** undoes everything the extension registered,
  in reverse order. A cleanup that throws is logged and the rest still run.
  Commands from other extensions that used yours are removed too, and must
  be registered again later.
- **If `activate` throws,** everything it registered is undone. The
  extension shows "Could not start" with the error in Preferences.
- **A folder with a missing or invalid `extension.json`** shows "Not a
  valid extension" with the reason.
- After an extension is turned off, its `api` throws "Extension is
  disposed". Work that already started is not cancelled.

## Example

[`examples/extensions/sample/`](../examples/extensions/sample) is a complete
extension:

- `backend.ts` registers an atomic `sample.capture` command, a
  `sample.describe` read command, a workflow that runs both, and a
  `tasks.add` listener that saves a setting.
- `frontend.tsx` registers a command, a view and a menu.
- `sample-task-view.tsx` lists tasks with `useExtensionEntries`.

To try it, point the app at the examples folder:
`EXTENSIONS_DIR=$PWD/examples/extensions bun run server`. Then turn
**Sample** on in Preferences.
