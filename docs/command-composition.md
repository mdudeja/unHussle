# Command composition and execution

Backend mutation, scheduler, and vault commands compile when a runtime is created.
The typed command interfaces and HTTP/event contracts remain unchanged.

`common/workflows/composition.ts` separates executable action registrations from
command definitions. Definitions name actions or other commands, declare TypeBox
input/output schemas, bind each step's input, and select an explicit result.
Bindings select the command input, a prior step's output, a literal, or an object
assembled from other bindings. Paths must name declared schema properties.
Definitions contain no executable callbacks; action implementations live in the
separate action registry. Schemas can be authored with TypeBox builders; registration also restores the
metadata needed to load ordinary JSON-schema definitions after serialization.
Executable schema transforms stay in the built-in adapters.

Registration compiles and caches the plan. It rejects missing targets, duplicate
step IDs, forward references, invalid paths, incompatible schemas, recursion,
and missing or misordered required actions. Replacing a definition recompiles
its dependents and restores the previous valid plans on failure. Commands called
inside an atomic definition inline their plans and share its transaction context.
No action or compiled plan starts a transaction.

The mutation adapter in `src-db-server/workflows/composition.ts` explicitly binds
subsequent integrity actions to the row operation's affected IDs and binds the
command result to that row operation. Kernel policies preserve required steps,
their input bindings, schemas, and result binding. The initial policies retain
all existing integrity-action ordering; they do not guess which domain operations
are safe to reorder. Additional ordering freedom needs explicit domain constraints.
Scheduler and vault actions retain their private typed state and early completion
behavior, with command-specific schemas and an explicit result action.

Execution has three boundaries:

1. Prepare the request, operation/trace metadata, and database connection before
   entering SQLite's synchronous transaction.
2. Execute the compiled plan once in one transaction. Validate action and command
   outputs before commit. A failure rolls back database changes, discards queued
   events, and compensates vault file changes in reverse order. Promise-returning
   atomic actions are rejected.
3. Publish committed announcements, then completion events, then await optional
   cleanup effects. Listener and cleanup failures are logged and cannot turn a
   committed write into a retryable write failure.

`runtime.workflows.execute(steps)` invokes supported commands sequentially. Each
command commits independently. A `WorkflowFailure` identifies `failedStep`, keeps
successful `{ id, result }` entries in `completed`, and preserves the original
error as `cause`. Later steps never run and writes are never retried. This is an
in-process execution foundation; plugin loading, SDK registration/lifecycle, and
a workflow editor remain deferred.

Regression tests cover compiler rejection and replacement recovery, inlined
execution, required kernel bindings and ordering, asynchronous action rejection,
partial workflow commits, vault compensation, tracking exclusivity, scheduler
revision conflicts, and existing event settlement behavior.
