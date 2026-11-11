# Mental models

Read this before the code. It explains the ideas behind the three complex
parts of unHussle, so the code reads as an expression of those ideas
rather than a maze of files.

Read in this order. The scheduler and extensions are both built on the
workflow runtime.

1. [Workflows](#workflows): how changes happen
2. [Scheduler](#scheduler): how a day is planned
3. [Extensions](#extensions): how outside code joins in

Each part has the same layout:

- the core idea in one sentence
- the few models to keep in your head
- common wrong assumptions
- where to start reading

The reference docs are [workflows.md](workflows.md),
[command-composition.md](command-composition.md), [scheduler.md](scheduler.md),
[extensions.md](extensions.md) and
[extensions-architecture.md](extensions-architecture.md).

---

## Workflows

> A change is a recipe, carried out once in a sealed room. News of it goes
> out only after the door opens, and everyone updates from the news.

### 1. Commands are recipes; actions are steps

A **command** is data: a list of named steps, each taking its input from
the command's input or an earlier step's output. An **action** is the
function behind one step.

The registry reads every recipe when it is registered. It checks that
every ingredient exists, every step's input fits, and the required steps
are in order. Then it keeps a ready-to-run **plan**. Running a command
just runs its plan.

So to find out what "delete a project" does, read its recipe: the action
list in `commandHandlers.ts`. The behaviour is not scattered through route
handlers.

### 2. The transaction is a sealed room

A backend command runs entirely inside one database transaction, and
nothing leaks out until it finishes:

- **Events** it wants to send are written on a list, not sent.
- **File changes** come with an undo note.
- **If anything fails,** the room is wiped. The database rolls back, the
  undo notes run, and the event list is thrown away.
- **If it succeeds,** the door opens and the events go out.

This is why actions must be synchronous: you cannot leave the room
halfway through and come back. The code that opens the room and posts the
news afterwards is called a **boundary**.

### 3. Events are the newspaper

After a commit, the backend publishes what happened:

- the family event (`entity.change`)
- the kind event (`tasks.change`)
- any side news, called announcements. For example, deleting an area
  announces that its tasks changed too.

Anyone can subscribe. The backend streams every event to every open
window over SSE.

The frontend does **not** update itself from its own HTTP response. It
updates from the newspaper. That one rule means a change made in another
window, or one the backend makes on its own (a break pausing your task),
refreshes the screen exactly like a change you made.

### 4. The frontend reads; it never owns the truth

The frontend keeps a cache of answers to questions: "tasks, page 1",
"area X's details". Each question lists what it depends on, such as
`tasks` or `schedule`.

- When news arrives, every question that depends on what changed is marked
  out of date.
- Questions currently on screen are asked again. The rest wait until
  someone looks.
- A slow, older answer can never overwrite a newer one.

Zustand holds UI state only. Entity rows live in this cache and nowhere
else.

### 5. A command "settles" when its news has been read

When the frontend sends a command, it first says "I'm expecting these two
events for operation X". Then it sends the request, and waits until those
events have arrived **and** their reactions have finished. Only then does
the command's promise resolve. So when `await startTask(id)` returns, the
screen is already up to date.

If the news never comes (the stream dropped, say), the frontend re-reads
after 3 seconds. It **never sends the write again**, because the write
may well have succeeded.

### 6. Failure after the commit is not failure

Once the door has opened, the change is real. A broken listener, a failed
file cleanup or a failed refresh is logged, or shown as "Your changes were
saved, but ... could not be refreshed" with a Retry that only re-reads.
None of these turns a saved change into an error.

### The whole picture

```text
UI ─▶ frontend command ─▶ HTTP ─▶ route ─▶ backend command
                                           │  sealed room: actions in one transaction
                                           ▼
                                   commit ─▶ events ─▶ SSE ─▶ every window
                                                              │
         screen ◀── cached questions refresh ◀── reactions ◀──┘
         (the command resolves once its own events are handled)
```

### Wrong assumptions

- **"The response updates the screen."** Events do. The response is
  returned, but the cache refreshes from events.
- **"On error, retry the write."** Never. Re-read instead.
- **"A route writes to the database."** Routes only run commands.
- **"Workflow means the `workflows/` folder."** Two meanings. The folder
  is this runtime. A workflow _definition_ is a command whose steps are
  other commands, each committing on its own.

### Start reading

1. `src-db-server/workflows/commandHandlers.ts`: the recipes.
2. `src-db-server/workflows/registerMutations.ts`: the mutation boundary, the sealed room.
3. `src/workflows/commandTransport.ts`: sending and settling.
4. `src/workflows/reactionRegistry.ts` and `queries.ts`: reacting and
   caching.

---

## Scheduler

> Rules are requests made in turn; the engine is a referee that says yes
> only if the request fits the day.

### 1. The scheduler plans entries, not tasks

A task is something you want done. An **entry** is that task as it
appears on one particular day:

- a one-off task has one entry
- a recurring task has one entry per time slot that day, called an
  **occurrence** (`taskId:date:slot`), with its own status and spent time

The engine only ever sees entries. Converting tasks to entries
(recurrence, estimates, windows) happens first, in `preparation.ts`.

### 2. Constraints are walls; preferences are a queue

There are two kinds of logic, kept strictly apart.

**Hard constraints** belong to the engine (`buildDay`):

- the waking window
- appointments
- recurring time windows
- anchors (do A right before or after B)
- the day's capacity
- the daily work limit

No preference can break them.

**Preferences** are **rules**: small named functions such as
`urgentCandidates` or `priorityRanking`.

- They run in the order the registry lists them.
- Each one asks for entries, and the engine places them only if they fit.
- Because time is scarce, **order is the preference**: whoever asks first
  gets the time.

To change what the scheduler prefers, change the rules or their order.
Never add a special case to the engine.

### 3. Pickers fill the day; arrangers tidy it

- **Pickers** choose which entries make the stack: active work,
  appointments, recurring slots, urgent work, and so on.
- **Arrangers** only reorder what is already in. Examples: lead with an
  easy starter, put a quick task between two long ones, push chores to the
  end of their group. The engine refuses any reorder that breaks an
  anchor.

### 4. Cues swap the playlist, not the engine

The same engine plans four kinds of moment. A **cue** picks which rules
run:

| Cue     | Moment             | Feel                                            |
| ------- | ------------------ | ----------------------------------------------- |
| `fresh` | Planning the day   | Commitments and urgency, led by something light |
| `break` | A break starts     | An easy way back in afterwards                  |
| `wrap`  | Wrapping up        | Only commitments and chores                     |
| `more`  | "I want more work" | Fill spare time, even past wind-down            |

### 5. Pencil and ink

- **Pencil.** Reading a day that hasn't been saved composes a stack on the
  spot and stores nothing.
- **Ink.** Generating or rescheduling saves it.
- **Ink stays put.** When tasks change later, a saved day keeps its order:
  - details (titles, status, appointments) are read live
  - the plan is flagged `stale` ("details changed")
  - only the user reorders it, by rescheduling

This keeps the day predictable. The stack never shuffles itself under you.

Every save increases a **revision**. A command based on an older revision
is rejected, so two windows can't silently overwrite each other.

### 6. A one-off belongs to one day at a time

A one-off task is like a library book: only one day can have it checked
out. Saving it on a later day returns it from earlier ones (`migrated`).
The week preview hands each one-off to at most one day. Deferring a task
hides it until the chosen date. Recurring slots are different: each day
gets its own.

### 7. Time is counted by intervals

Spent time is not typed in. It comes from **intervals**: start and stop
records.

- Only one thing runs at a time. Starting something closes every other
  open interval and pauses its task.
- Remaining time is the estimate minus the time already spent.
- An interval left running overnight is never counted in full silently.
  The user is asked when they actually stopped.

### 8. Day modes are moods, and they stay calm

- **Break:** all running work pauses and the stack is replanned for an
  easy return. There is no countdown. Ending the break keeps that stack.
- **Wrap-up:** only commitments and chores remain. It can start on its
  own, near wind-down or during the last task, and always says why.
- **The escape hatch:** the user can always pull more. That ends wrap-up
  and turns off automatic wrap-up for the day.

The product principle behind all three: the app reduces pressure. Nothing
should feel like a timer running out.

### 9. "Next task" is a lens, not a plan

The home card doesn't store a "current task". It looks at the saved stack
and the clock, and picks:

1. what's running
2. otherwise a current appointment
3. otherwise the first ready entry that fits before the next appointment

"Do something else" just skips entries in that lens, for today.

### Wrong assumptions

- **"Add the new behaviour to `buildDay`."** Only if it is a hard
  constraint. Preferences are rules.
- **"Reading a day saves it."** Reads never write.
- **"Stale means broken."** Stale means details changed since the order
  was chosen. The order is still the user's.
- **"An easy starter jumps the queue."** Only among equally urgent work.
  Comfort never outranks urgency when a stack is led.

### Start reading

1. `common/scheduler/ruleRegistry.ts`: the playlists.
2. `common/scheduler/rules.ts`: what each preference asks for.
3. `common/scheduler/engine.ts`, `buildDay` and `place`: the referee.
4. `src-db-server/workflows/schedulerActions.ts`: how commands save and
   change days.

---

## Extensions

> Extensions are tenants in the same building. Each gets its own floor,
> uses the building's services, and everything it brings in leaves with
> it.

### 1. No side door

An extension's commands go into the **same registry** as the built-in
commands, and are checked the same way. That brings two guarantees:

- An extension cannot skip the app's integrity steps. It cannot call the
  private actions that write rows directly.
- To change data it either:
  - runs public commands, or
  - inside its own transaction, calls `domain.mutations.apply`, which runs
    the built-in recipe in full

The host adds no new execution engine. It is a doorman, not a second
building.

### 2. A scope is a lease

When an extension activates, the host opens a **scope** for it and records
everything it registers: actions, commands, listeners, menus, views, and
cleanups passed to `api.own`.

- **Turning it off** ends the lease. Everything is undone in reverse
  order, and the extension's `api` stops working.
- **Commands from other extensions that used it** are removed too, so
  nothing keeps calling code that is gone.
- **If activation throws,** the lease is cancelled the same way.

Every ID starts with the extension's own namespace (`sample.capture`):
that is its floor.

### 3. Two halves in two worlds

An extension can have a backend entry and a frontend entry. They run in
different processes and share nothing in memory.

- The **backend** half lives in the database server. It can run commands
  in one transaction (atomic commands).
- The **frontend** half lives in the app window. It can add menus and
  pages.

The two halves talk the way the app itself does: through commands and
events.

### 4. Discovery is a mailbox with an on switch

The user picks an extensions folder. Each subfolder with an
`extension.json` is a candidate.

- The server lists them, reporting any problem in plain words.
- Nothing runs until the user turns an extension on. The database
  remembers that choice.
- Turning one on bundles and loads its backend half, and then the window
  loads its frontend half.
- Editing the code takes effect after a rescan.

### 5. Borrowed furniture

Extensions don't ship their own React or TypeBox. When an extension is
bundled, those imports, and the `unhussle/*` SDK, are wired to the copies
the app already has. That way a view is part of the app's React tree, and
extensions need no `node_modules`.

### 6. Trusted, with guardrails

Extensions run in-process with full access. They are trusted code, and the
app says so when one is turned on. The checks (namespaces, the registry's
validation, scopes) prevent **accidents**: a typo, a forgotten cleanup, a
broken integrity rule. They are not a security boundary.

### Wrong assumptions

- **"An extension can replace a built-in command."** No. It can only add
  commands under its own namespace.
- **"An extension can write SQL."** It never receives the database or a
  transaction; it gets queries and commands.
- **"Turning an extension off deletes its settings."** Settings stay, and
  come back when it is turned on again.
- **"Saving a file reloads the extension."** Rescan to load new code.

### Start reading

1. `examples/extensions/sample/`: a complete extension.
2. `common/extensions/host.ts`: the scope and lease.
3. `src-db-server/extensions/manager.ts`: discovery and switching on and
   off.
4. `src/extensions/loader.ts`: loading the frontend half.
