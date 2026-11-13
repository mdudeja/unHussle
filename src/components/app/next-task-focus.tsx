import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { addDaysToDate } from '@c/calendarUtils'
import type { DayPlan, PlanEntry } from '@c/scheduler/contracts'
import type { ProgressStatus } from '@c/types/enums'
import { Badge } from '@/components/ui/badge'
import { CardTitle } from '@/components/ui/card'
import {
  DateMeta,
  StatusPriorityIcons,
  TaskFlags,
} from '@/components/ui/custom/list/fields'
import { ActionControls } from '@/components/app/action-controls'
import { DeferDialog } from '@/components/app/defer-dialog'
import { EntryTimer } from '@/components/app/entry-timer'
import { TaskContextSheet } from '@/components/app/TaskContextSheet'
import { usePlanEntryActions } from '@/lib/entityActions/use-plan-entry-actions'
import { useRunAction } from '@/lib/entityActions/use-run-action'
import { entryTimeOf, isRunning } from '@/lib/day-plan'
import { getEntityItemRoute } from '@/lib/entityRoutes'
import { formatSpentTime } from '@c/datetimeUtils'
import { useWorkflowRuntime } from '@/workflows/hooks'
import { adjustEntry } from '@/workflows/plan-entry-commands'
import { visibleActions } from '@/lib/entityActions'
import { useHotkey } from '@/hooks/use-keydown-mgr'
import { HOTKEY_BUSY_MESSAGE, HOTKEYS, HotkeyId } from '@/lib/hotkeys'

// Shown as buttons, in this order; the rest go in the menu.
const BUTTON_IDS = ['start', 'pause', 'done']
// Reordering belongs to the day view, where the whole stack is visible.
const CARD_ACTION_IDS = new Set([
  ...BUTTON_IDS,
  'edit',
  'skip',
  'later',
  'defer-occurrence',
  'defer',
])

type NextTaskFocusProps = {
  plan: DayPlan
  item: PlanEntry
  skipped: Set<string>
  skip: (id: string) => void
  /** Replaces the actions until answered, e.g. the overnight check. */
  blocker?: React.ReactElement
}

/** The task to do now: what it is, how long it takes, and what to do with it. */
export function NextTaskFocus({
  plan,
  item,
  skipped,
  skip,
  blocker,
}: NextTaskFocusProps) {
  const runtime = useWorkflowRuntime()
  const [deferring, setDeferring] = useState<PlanEntry | null>(null)
  const actions = usePlanEntryActions({
    plan,
    today: plan.date,
    skipped,
    skip,
    onDefer: setDeferring,
  }).filter((action) => CARD_ACTION_IDS.has(action.id))
  const runner = useRunAction(item)
  const time = entryTimeOf(item)
  const navigate = useNavigate()

  // Hotkeys only run what the buttons and menu offer right now.
  const runAction = (hotkeyId: HotkeyId, ...actionIds: string[]) => {
    if (blocker) return 'Answer the question on the card first.'
    if (runner.pendingId !== null) return HOTKEY_BUSY_MESSAGE
    const action = visibleActions(actions, item).find(({ id }) =>
      actionIds.includes(id),
    )
    if (!action || action.isDisabled?.(item)) {
      return `${HOTKEYS[hotkeyId].title} isn’t available for the current task.`
    }
    runner.trigger(action)
  }
  useHotkey('next-task.start', () => runAction('next-task.start', 'start'))
  useHotkey('next-task.pause', () => runAction('next-task.pause', 'pause'))
  useHotkey('next-task.done', () => runAction('next-task.done', 'done'))
  useHotkey('next-task.skip', () => runAction('next-task.skip', 'skip'))
  useHotkey('next-task.later', () => runAction('next-task.later', 'later'))
  useHotkey('next-task.another-day', () =>
    runAction('next-task.another-day', 'defer', 'defer-occurrence'),
  )
  useHotkey('next-task.edit', () => runAction('next-task.edit', 'edit'))
  useHotkey(
    'next-task.details',
    () => void navigate(getEntityItemRoute('tasks', item.taskId)),
  )

  return (
    <section className="flex flex-col gap-4" aria-label="Task to do now">
      <div className="flex flex-col gap-2">
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Link
            to={getEntityItemRoute('tasks', item.taskId)}
            className="hover:underline"
          >
            {item.title}
          </Link>
          <StatusPriorityIcons
            status={item.status as ProgressStatus}
            priority={item.priorities[0]}
          />
        </CardTitle>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {time && <span>{time}</span>}
          {isRunning(item) ? (
            <span className="text-primary">
              Running{' '}
              <EntryTimer
                spentMinutes={item.spentMinutes}
                startedAt={item.startedAt}
              />
            </span>
          ) : (
            item.minutes > 0 && (
              <span>{formatSpentTime(item.minutes)} left</span>
            )
          )}
          <TaskFlags
            task={{
              is_fun: item.isFun,
              is_quick: item.isQuick,
              is_chore: item.isChore,
            }}
          />
          {item.occurrenceId && <Badge variant="outline">Recurring</Badge>}
          <DateMeta label="Due" millis={item.due} />
          <TaskContextSheet taskId={item.taskId} />
        </div>
      </div>

      {blocker ?? (
        <div className="flex flex-wrap items-center gap-2">
          <ActionControls
            runner={runner}
            actions={actions}
            buttonIds={BUTTON_IDS}
            primaryVariant="default"
            size="default"
            title={item.title}
          />
        </div>
      )}
      {runner.error && (
        <p role="alert" className="text-sm text-destructive">
          {runner.error}
        </p>
      )}

      <details className="text-sm text-muted-foreground">
        <summary className="cursor-pointer">Why this task?</summary>
        <p className="mt-2">{item.reason}</p>
      </details>

      {deferring && (
        <DeferDialog
          title={deferring.title}
          earliest={addDaysToDate(plan.date, 1)}
          onConfirm={(until) =>
            adjustEntry(runtime, plan, deferring, 'defer', { until })
          }
          onClose={() => setDeferring(null)}
        />
      )}
    </section>
  )
}
