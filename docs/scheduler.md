# Scheduler

For maintainers. This covers how unHussle builds, saves and keeps a day's
stack, across `common/scheduler`, the backend and the frontend.

- The concepts behind it are in [mental-models.md](mental-models.md#scheduler).
- Scheduler commands run on the workflow runtime described in
  [workflows.md](workflows.md).
- The README covers the user-facing behaviour (Next task, Day, Week,
  Preferences) and the [scheduler flow](../README.md#scheduler-flow).

## Principles

- **The engine is pure.** `common/scheduler` takes plain entries and
  settings and returns a plan. It never reads the database, the clock or
  the UI.
- **Rules are preferences; the engine owns constraints.** Rules pick and
  arrange entries. Fixed times, windows, anchors, capacity and the daily
  work limit are enforced by `buildDay` on every pick and move.
- **A saved day is stable.** Once saved, a day keeps its order. Task edits
  update the details live and mark the plan `stale`. A new order only
  comes from an explicit replan.
- **Reads never write.** Reading an unsaved day composes a tentative
  stack on the fly. Only commands save plans or create occurrences.
- **One-offs belong to one day.** A one-off task is in at most one current
  or future plan. Saving it on a later day migrates earlier memberships.
- **No pressure.** Breaks have no timer, wrap-up shows only chores, and the
  user can always pull more work. Every automatic change says why.

## Vocabulary

| Term           | Meaning                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------- |
| **Plan entry** | One schedulable unit on one day: a one-off task, or one slot of a recurring task (`PlanEntry`)     |
| **Occurrence** | A recurring task on a date and slot, ID `taskId:date:slot`. Has its own status and spent time.     |
| **Stack**      | A day's ordered entries                                                                            |
| **Day plan**   | A stack plus its mode, conflicts and totals (`DayPlan`). Saved or tentative.                       |
| **Cue**        | Why a stack is being built: `fresh`, `break`, `wrap` or `more`                                     |
| **Rule**       | A named preference: a **picker** (chooses entries) or an **arranger** (reorders them)              |
| **Anchor**     | A task's link to another: `before` or `after` (adjacent), `any_before` or `any_after` (order only) |
| **Day mode**   | `normal`, `break` or `wrap`, derived from `breakStartedAt` and `wrapReason`                        |
| **Conflict**   | A plain-language note on why something could not be placed as asked                                |

## Modules

| Module                                             | Responsibility                                                                     |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `common/scheduler/contracts.ts`                    | Types, cues, rule names, settings and defaults, commands and events                |
| `common/scheduler/preparation.ts`                  | Tasks to entries: recurrence (`occursOn`), estimates, windows, anchor satisfaction |
| `common/scheduler/engine.ts`                       | `dayWindow`, `buildDay` (constraints), `nextTask` (the home card's pick)           |
| `common/scheduler/rules.ts`                        | Rule implementations and the `PlanRuleContext` they work through                   |
| `common/scheduler/ruleRegistry.ts`                 | Rule order per cue; `rulesFor` applies `settings.rules`                            |
| `common/scheduler/anchors.ts`                      | Anchor targets, groups, chains, ordering, cycles and violations                    |
| `common/scheduler/dayMode.ts`                      | `dayModeOf`, `windDownOf`, `wrapUpReason`, `runningSinceEarlierDay`                |
| `common/scheduler/validation.ts`, `status.ts`      | Settings and recurrence validation; pending statuses                               |
| `src-db-server/workflows/scheduler.ts`             | Reads: `readDay`, `composeDay`, saved-day hydration, `previewWeek`, `readNext`     |
| `src-db-server/workflows/schedulerActions.ts`      | Actions over the carried `SchedulerState`                                          |
| `src-db-server/workflows/schedulerHandlers.ts`     | Ordered actions per scheduler command                                              |
| `src-db-server/database/repositories/scheduler.ts` | SQL: eligibility, occurrences, exclusions, plan writes, staleness, migration       |
| `src-db-server/domain/tracking.ts`                 | Time intervals: exclusive starts, pauses, totals                                   |
| `src-db-server/domain/scheduleMaintenance.ts`      | Keeping saved plans in step with task edits                                        |
| `src-db-server/routes/scheduler.ts`                | `/scheduler` reads and commands; a stale revision returns 409                      |
| `src/services/scheduler.ts`                        | HTTP client                                                                        |
| `src/workflows/schedulerHooks.ts`                  | `useDayPlan`, `useTodayPlan`, the clock, skipped tasks, overnight answers          |
| `src/components/app/NextTaskCard.tsx`              | The home card: next task, break, wrap-up, overnight stop                           |
| `src/pages/PlannerPages.tsx`                       | Day, Week and Preferences pages                                                    |

## Storage

| Table                  | Holds                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `day_plans`            | One row per `timezone:date`: `revision`, `stale`, `conflicts`, `breakStartedAt`, `wrapReason`, `autoWrap` |
| `plan_items`           | A saved stack: `itemId`, `sourceTaskId`, `occurrenceId`, `position`, `status`, `pinned`, `reason`         |
| `task_occurrences`     | Created when a plan with that occurrence is saved: `status`, `spentMinutes`, `date`, `slot`               |
| `scheduling_overrides` | Deferrals: a one-off is hidden until `availableDate`                                                      |
| `scheduler_settings`   | One `default` row. Read over `defaultSchedulerSettings`, so new fields get defaults.                      |
| `time_entries`         | Tracking intervals, the source of spent time                                                              |

Plan rows keep `sourceTaskId` as plain text, alongside nullable foreign
keys. A deleted task therefore leaves its history in the plan as a
"Deleted task" entry.

## Building a stack

`composeDay` (backend) runs these steps for a day that is not saved, or
when a command replans one:

1. **Select.** `readDayTasks` picks the pending tasks eligible on the date,
   in SQL:
   - recurring tasks whose rule matches the weekday, month day and month
   - one-offs that are in progress, unscheduled, or scheduled on that day

   Anchor targets come along as references, which are never scheduled.
   Work is decided by `settings.workTags`, including tags inherited from
   collections.

2. **Exclude.** `readExclusions` removes:
   - one-offs deferred past this date
   - one-offs reserved by another current or future plan
3. **Expand.** `prepareCandidates` turns each task into entries:
   - **One-offs:**
     - remaining minutes = estimate minus spent time. The estimate is
       `quickMinutes` for quick tasks, otherwise `defaultMinutes`.
     - fixed times come from `scheduled_start` and `scheduled_end`
   - **Recurring:** one entry per slot, with the slot's window and the
     occurrence's state.
   - In-progress occurrences from earlier days continue today.
   - An `after` anchor on a completed one-off counts as satisfied.
4. **Build.** `buildDay` (pure) produces the stack (next section).
5. **Merge history.** When replanning, finished entries from the previous
   stack stay ahead of the new ones. A past date gets no new suggestions.

### `buildDay`

1. **Window.** `dayWindow` runs from wake until sleep, honouring
   per-date `overrides`. For today it starts at now. With the `wrap` and
   `more` cues, a day already past wind-down runs until midnight.
2. **Anchors.** `resolveAnchors` does the following:
   - finds each anchored entry's target
   - groups linked entries, and collapses adjacent anchors into chains
   - sorts the groups so anchors hold
   - blocks entries with cycles or missing targets, recording why
3. **Appointments.** Entries with fixed times reserve their time first.
   Overlaps become conflicts.
4. **Rules.** Each rule for the cue runs in registry order, through
   `PlanRuleContext`.
5. **Safety net.** Remaining appointments and in-progress or paused work
   are always placed.
6. **Result.** The stack, conflicts, `workPlanned`, `capacityMinutes` and
   `backlogCount`.

When a rule picks an entry, `place` handles its **whole anchor group**:

- **Work limit:** it checks `workUsed + workPlanned` against the daily work
  limit. Only work-tagged entries count.
- **Fit:** it fits each member into free time, in order, inside its window
  and before the next fixed time. A late occurrence may still go after
  its window.
- **Not required:** if the group doesn't fit, it is skipped. The `more`
  cue places it anyway, with a conflict.
- **Required:** it is placed regardless, with a conflict that says why.

`move` refuses any reorder that would add an anchor violation.

### Rules and cues

**Pickers** claim entries. Earlier pickers win capacity.

| Picker                 | Claims                                                             | Required |
| ---------------------- | ------------------------------------------------------------------ | -------- |
| `keepActive`           | In-progress, paused and pinned entries                             | Yes      |
| `preScheduled`         | Appointments, by start time                                        | Yes      |
| `recurringOccurrences` | Recurring slots, by window                                         | Yes      |
| `urgentCandidates`     | Overdue, then due today                                            | Yes      |
| `resumePaused`         | Paused one-offs                                                    | No       |
| `dueSoon`              | Due within a week                                                  | No       |
| `priorityRanking`      | Everything: task, project, goal, then area priority; then due date | No       |
| `dueDateRanking`       | Anything with a due date                                           | No       |
| `oldestFirst`          | Everything, oldest first                                           | No       |
| `wrapChores`           | Chores only, most urgent first                                     | No       |

**Arrangers** reorder placed, movable entries (no anchor, no fixed time):

| Arranger                | Does                                                                     |
| ----------------------- | ------------------------------------------------------------------------ |
| `starterTask`           | Leads with a fun or quick task that is no less urgent than the first one |
| `easyReturn`            | The same, after a break                                                  |
| `quickOrFunBetweenLong` | Puts a quick or fun task between two long ones                           |
| `choresLast`            | Moves chores toward the end of their urgency group                       |
| `restorePins`           | Returns pinned and active entries to their saved positions               |

Rules per cue (`ruleRegistry.ts`):

| Cue     | When                       | Rules                                                                                                |
| ------- | -------------------------- | ---------------------------------------------------------------------------------------------------- |
| `fresh` | Generating or rescheduling | all pickers except `wrapChores`, `starterTask`, `quickOrFunBetweenLong`, `choresLast`, `restorePins` |
| `break` | A break starts             | the same pickers, `easyReturn` instead of `starterTask`                                              |
| `wrap`  | Wrapping up                | `keepActive`, `preScheduled`, `wrapChores`, `restorePins`                                            |
| `more`  | The user pulls more        | the same pickers, `quickOrFunBetweenLong`, `choresLast`, `restorePins`                               |

`settings.rules[cue]` replaces a cue's list entirely. Unknown rule names
are skipped with a warning. Urgency is 0 for overdue, 1 for due today, 2
for due within a week, and 3 otherwise.

Arrangers never trade urgency for comfort when leading:

- A starter (or easy return) only leads when it is at least as urgent as
  the entry it replaces.
- Between two long tasks, a quick or short task may be moved forward. A
  fun task is moved only when it is at least as urgent.

`common/__tests__/scheduler.test.ts` pins this behaviour.

## Commands

All scheduler commands are atomic composition commands. Their actions run
over one `SchedulerState` inside one transaction
([workflows.md](workflows.md#backend-running-a-command)).

| Command                           | Actions                                                                                                  | Event                          |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `scheduler.generate`              | `expireOccurrences`, `loadPlan`, `checkRevision`, `keepSaved`, `buildPlan`, `savePlan`                   | `scheduler.changed`            |
| `scheduler.replan`                | `expireOccurrences`, `loadPlan`, `checkRevision`, `buildPlan`, `savePlan`                                | `scheduler.changed`            |
| `scheduler.adjust`                | `expireOccurrences`, `loadPlan`, `checkRevision`, `adjustPlan`, `checkAnchors`, `savePlan`               | `scheduler.changed`            |
| `scheduler.mode.change`           | `expireOccurrences`, `loadPlan`, `checkRevision`, `changeMode`, `pauseForBreak`, `buildPlan`, `savePlan` | `scheduler.mode.changed`       |
| `scheduler.settings.change`       | `saveSettings`                                                                                           | `scheduler.settings.changed`   |
| `scheduler.occurrence.transition` | `transitionOccurrence`, `trackOccurrenceInterval`                                                        | `scheduler.occurrence.changed` |
| `scheduler.tracking.stop`         | `stopTracking`                                                                                           | `scheduler.tracking.stopped`   |

What the actions guarantee:

- **`expireOccurrences`** marks earlier planned or paused occurrences as
  `missed`. Missed occurrences never become backlog.
- **`checkRevision`** rejects a stale `revision`. The route returns 409:
  "The plan changed. Refresh before editing it again."
- **`keepSaved`** makes generation idempotent: a saved day is returned
  unchanged.
- **`buildPlan`** does three things:
  - keeps a wrapping-up day on `wrap` unless the cue is `more`, which ends
    wrap-up and clears `autoWrap`
  - follows the week preview for unsaved days this week, so saving keeps
    the preview's allocation
  - keeps finished entries from the previous stack ahead of the new ones
- **`adjustPlan`** supports `later`, `move`, `pin` and `defer`:
  - In-progress work cannot move.
  - Appointments are moved by editing their time.
  - Deferring a one-off writes a scheduling override.
  - Deferring an occurrence marks it `skipped`.
- **`checkAnchors`** rolls back a manual move that breaks an anchor.
- **`savePlan`** bumps `revision`, writes the items and creates their
  occurrences. It also migrates earlier pending memberships of the same
  one-offs to `migrated`, and clears `stale`.
- **`saveSettings`** validates the settings and marks current and future
  plans `stale`.

## Day modes

| Change       | Effect                                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| `startBreak` | Sets `breakStartedAt`, pauses all open work (`pauseOpenWork`, announced as task changes), replans with `break` |
| `endBreak`   | Clears `breakStartedAt` and keeps the stack planned when the break started                                     |
| `startWrap`  | Sets `wrapReason` and replans with `wrap`                                                                      |

- A break outranks wrap-up: `dayModeOf` reports `break` while both are
  set, and wrap-up resumes when the break ends.
- A repeated change returns the plan unchanged.
- An automatic `startWrap` (reason `lastTask` or `windDown`) is ignored:
  - during a break
  - when the day is already wrapping up
  - after the user pulled more (`autoWrap = false`)

`wrapUpReason(plan, now)` decides when wrap-up starts on its own. It only
applies to today's saved plan, in normal mode, with `autoWrap` on.

| Reason     | When                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| `windDown` | Within `wrapMinutes` before wind-down (sleep time), never after it                                       |
| `lastTask` | The last flexible non-chore task is in progress with at most `wrapMinutes` left (at once if it is short) |

`useTodayPlan` evaluates this on its clock and sends the change once per
reason per day.

## Keeping saved plans consistent

Saved plans are touched by entity commands as well as scheduler commands:

| Trigger                                                                                                               | Action               | Effect                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An edit to a schedule-relevant field (`scheduleFields`), any tag change, a task create or delete, a collection delete | `markPlansStale`     | Plans from yesterday (UTC) onward get `stale = true`. The UI says "details changed" and offers a reschedule.                                                                                |
| A task change or delete                                                                                               | `syncPlanMembership` | One-off rows follow the task's status, and deleted tasks become `cancelled`. Occurrences no longer produced by the rule are cancelled or removed. The affected plans' revisions are bumped. |
| Starting work (task or occurrence)                                                                                    | `trackInterval`      | Every other open interval closes and its task or occurrence pauses. Spent minutes accumulate.                                                                                               |

A saved day is read by `hydrateSaved`:

- It takes the stored order, then merges in live task, occurrence and
  interval data.
- Appointments added after saving appear automatically.
- Running entries show `startedAt`, and their remaining minutes count
  down.

## Reads

| Route                       | Function       | Notes                                                                 |
| --------------------------- | -------------- | --------------------------------------------------------------------- |
| `GET /scheduler/day/:date`  | `readDay`      | The saved day, hydrated; otherwise a tentative `composeDay`           |
| `GET /scheduler/week/:date` | `previewWeek`  | Seven days. Each one-off appears on at most one day; saved plans win. |
| `GET /scheduler/next/:date` | `readNext`     | `nextTask` on the server. The frontend computes it locally instead.   |
| `GET /scheduler/settings`   | `readSettings` | Saved settings over defaults                                          |

All take `?timezone=`. Plan IDs are `timezone:date`, so the same date in
two time zones is two plans.

## Frontend

- **`useDayPlan(date, timezone)`** queries `schedule:day:<tz>:<date>`. It
  depends on every kind that can change a plan, and refreshes when the
  window regains focus.
- **`useTodayPlan`** does three jobs:
  - it generates today's plan once if it isn't saved
  - it sends the automatic wrap-up
  - it re-reads at the next time boundary (an appointment or window
    edge), or every minute, without regenerating
- **The Next task card** works like this:
  - It calls `nextTask(plan, now, skipped)`: active work, else a current
    appointment, else the first ready entry whose chain fits before the
    next appointment. Entries that are blocked, skipped, waiting on
    anchors, or outside their window are left out.
  - "Do something else" skips are kept per day in localStorage.
  - On a break it shows the break and only a peek at what's next.
- **Overnight work.** When an interval has run since an earlier day
  (`runningSinceEarlierDay`), the card asks when the user stopped and
  sends `scheduler.tracking.stop`. A "still on it" answer is remembered
  per interval.
- **Refreshes.** Scheduler commands run on the frontend lifecycle queue.
  Their events refresh `schedulerEventDependencies[event]`
  ([workflows.md](workflows.md#reactions)).

## Changing the scheduler

| To add                    | Do                                                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A planning preference     | Implement it in `rules.ts` against `PlanRuleContext`, add its name to `planRuleNames`, and place it in the cue lists in `ruleRegistry.ts`. Never add preference logic to `buildDay`.        |
| A hard constraint         | Enforce it in `buildDay` (`place`, `fit` or `reserve`), so that no rule can bypass it.                                                                                                      |
| A cue                     | Add it to `scheduleCues` and `planRuleRegistry`, then decide which command or mode uses it.                                                                                                 |
| A scheduler command       | Add actions to `schedulerActions.ts`, list them in `schedulerHandlers.ts`, add schemas to `stateCommandSchemas`, an event to `schedulerCommandEvents`, a route, and its query dependencies. |
| A schedule-relevant field | Add it to `scheduleFields` so edits mark plans stale.                                                                                                                                       |
| A setting                 | Add it to `SchedulerSettings` and `defaultSchedulerSettings`, validate it in `validateSettings`, and add it to the HTTP schema.                                                             |

Wording: recurring tasks are not necessarily habits, so never call them
habits in code, copy or reasons.

## Tests

| Covers                                                                                                                                | File                                        |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Engine: urgency, capacity, estimates, starters, appointments, anchors, recurrence, DST, rules, day windows, day modes                 | `common/__tests__/scheduler.test.ts`        |
| Commands, persistence, idempotence, revisions, deferrals, week previews, occurrences, work tags, maintenance, day modes, carried work | `src-db-server/__tests__/scheduler.test.ts` |
| Exclusive tracking across tasks and occurrences, breaks that leave work running                                                       | `src-db-server/__tests__/domain.test.ts`    |
| Frontend settlement, refresh scope, warnings, timer reconciliation, resync, overnight prompts                                         | `src/__tests__/schedulerWorkflows.test.ts`  |
