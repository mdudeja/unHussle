# Workflows and completion events

`createRuntime` supplies the same typed command/event API in either process.
Each runtime has its own context and listeners. HTTP remains the boundary
between frontend and backend; importing this module does not bridge processes.

## Required work

Declare command input/result types, then register exactly one handler with
`commands.handle(name, (input, context) => ...)`. Call it through
`commands.execute(name, input)`. Compose required steps explicitly and await
them. Exceptions fail the command. Duplicate or missing handlers are errors.

Backend mutations are registered in `src-db-server/workflows/runtime.ts`.
Handlers open a unit of work and obtain repositories bound to its transaction:

```typescript
await context.unitOfWork.transaction(({ repository, tx }) => {
  const tasks = repository(taskTable)
  const task = tasks.insert(values)
  if (!task) throw new Error('Task could not be inserted')
  syncAttachments(tx, task.id, attachments)
  return task
})
```

Transaction callbacks and their repository methods must be synchronous.
Do not call async read repositories or HTTP services inside a SQLite
transaction. `attachmentCapabilities` declares which entities support tags
and URLs; composition replaces the old attachment repository inheritance.
Owner and reference cleanup also runs through these mutation handlers.

## Independent reactions

Register `events.on('entity.changed', (event, context) => ...)` for work that
reacts to an already successful mutation. Registration returns an unsubscribe
function. `publish` waits for all listeners and reports each outcome; one
failure does not prevent other listeners from running. Required integrity
rules belong in commands, not completion listeners.

Frontend mutation listeners centralize query invalidation and catalog
refreshes. Extend dependency declarations when adding relations. Reads do not
publish mutation events. Refresh failures produce a separate warning whose
Retry repeats only the read, never the committed write.

## UI and lifecycle

Use the existing entity slice methods for CRUD and workflow query hooks for
loading. Detail/search/related query results do not change list membership.
Related panels subscribe only while mounted. Requests are deduplicated, empty
results are cached, and obsolete responses cannot overwrite fresh results.

Use task lifecycle commands for timer/status changes. Tracking state is
observable and its localStorage format is preserved. Session data is retained
when persistence fails. Brain Dump submission returns failed URL inputs so a
partial submission can be retried without repeating successful writes.

Runtime factories allow isolated contexts in tests. The default frontend
runtime is shared by store `getState` identity, including Zustand's bound
React hook and vanilla API. Dispose registrations and queries during teardown
or hot reload. Events are not durable and writes are not automatically retried.
