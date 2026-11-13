import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Check,
  Clock,
  Pause,
  Pencil,
  Pin,
  PinOff,
  Play,
  SkipForward,
} from 'lucide-react'
import type { DayPlan, PlanEntry } from '@c/scheduler/contracts'
import { runningSinceEarlierDay } from '@c/scheduler/dayMode'
import { isPending } from '@c/scheduler/status'
import { ProgressStatus } from '@c/types/enums'
import { useStore } from '@/store'
import { isRunning } from '@/lib/day-plan'
import type { OvernightPrompt } from '@/store/slices/createUISlice'
import { useWorkflowRuntime } from '@/workflows/hooks'
import { isStillWorking, overnightKey } from '@/workflows/schedulerHooks'
import { adjustEntry, transitionEntry } from '@/workflows/plan-entry-commands'
import type { EntityAction } from './types'

type PlanEntryActionsOptions = {
  plan: DayPlan
  /** Today's date; skipping only steers today's next task. */
  today: string
  skipped: Set<string>
  skip: (id: string) => void
  /** Asks for the date a one-off task becomes available again. */
  onDefer: (entry: PlanEntry) => void
}

const isActive = isRunning
const isOpen = (entry: PlanEntry) => isPending(entry.status)
const isWaiting = (entry: PlanEntry) => isOpen(entry) && !isActive(entry)
const isFlexible = (entry: PlanEntry) => entry.fixedStart === null

/**
 * What the next task card offers, for every entry of a day: start, pause,
 * done, edit, set aside, later today, another day, reorder and pin.
 * Reordering and postponing need a saved plan; a running task can be
 * reordered but not postponed.
 */
export const usePlanEntryActions = ({
  plan,
  today,
  skipped,
  skip,
  onDefer,
}: PlanEntryActionsOptions): EntityAction<PlanEntry>[] => {
  const runtime = useWorkflowRuntime()
  const indexOf = (entry: PlanEntry) =>
    plan.entries.findIndex((candidate) => candidate.id === entry.id)
  const canReorder = (entry: PlanEntry) =>
    plan.saved && isOpen(entry) && isFlexible(entry)
  const canPostpone = (entry: PlanEntry) =>
    canReorder(entry) && !isActive(entry)

  // Work running since an earlier day asks when the user stopped first.
  const askedOvernight = (entry: PlanEntry, then: OvernightPrompt['then']) => {
    const { startedAt } = entry
    if (
      startedAt === undefined ||
      !runningSinceEarlierDay(entry, today, plan.timezone) ||
      isStillWorking(overnightKey(entry.taskId, entry.occurrenceId, startedAt))
    ) {
      return false
    }
    useStore.getState().askOvernight({
      taskId: entry.taskId,
      occurrenceId: entry.occurrenceId,
      startedAt,
      then,
    })
    return true
  }

  return [
    {
      id: 'start',
      label: 'Start',
      icon: Play,
      run: (entry) =>
        transitionEntry(runtime, entry, ProgressStatus.IN_PROGRESS),
      isVisible: isWaiting,
    },
    {
      id: 'done',
      label: 'Done',
      icon: Check,
      run: (entry) =>
        askedOvernight(entry, 'complete')
          ? undefined
          : transitionEntry(runtime, entry, ProgressStatus.COMPLETED),
      isVisible: isOpen,
    },
    {
      id: 'pause',
      label: 'Pause',
      icon: Pause,
      variant: 'outline',
      run: (entry) =>
        askedOvernight(entry, 'pause')
          ? undefined
          : transitionEntry(runtime, entry, ProgressStatus.PAUSED),
      isVisible: isActive,
    },
    {
      id: 'edit',
      label: 'Edit',
      icon: Pencil,
      variant: 'outline',
      run: (entry) => useStore.getState().openEditor('tasks', entry.taskId),
    },
    {
      id: 'skip',
      label: 'Do something else',
      icon: SkipForward,
      variant: 'outline',
      run: (entry) => skip(entry.id),
      isVisible: (entry) =>
        plan.saved &&
        plan.date === today &&
        isWaiting(entry) &&
        !skipped.has(entry.id),
    },
    {
      id: 'later',
      label: 'Later today',
      icon: Clock,
      variant: 'outline',
      run: (entry) => adjustEntry(runtime, plan, entry, 'later'),
      isVisible: canPostpone,
    },
    {
      id: 'defer-occurrence',
      label: 'Skip this occurrence',
      icon: CalendarClock,
      variant: 'outline',
      run: (entry) => adjustEntry(runtime, plan, entry, 'defer'),
      isVisible: (entry) => canPostpone(entry) && entry.occurrenceId !== null,
      confirm: {
        title: 'Skip this occurrence?',
        description: () => 'Future occurrences will stay in place.',
        confirmLabel: 'Skip occurrence',
      },
    },
    {
      id: 'defer',
      label: 'Another day',
      icon: CalendarClock,
      variant: 'outline',
      run: onDefer,
      isVisible: (entry) => canPostpone(entry) && entry.occurrenceId === null,
    },
    {
      id: 'move-up',
      label: 'Move up',
      icon: ArrowUp,
      variant: 'outline',
      run: (entry) =>
        adjustEntry(runtime, plan, entry, 'move', {
          position: indexOf(entry) - 1,
        }),
      isVisible: (entry) => canReorder(entry) && indexOf(entry) > 0,
    },
    {
      id: 'move-down',
      label: 'Move down',
      icon: ArrowDown,
      variant: 'outline',
      run: (entry) =>
        adjustEntry(runtime, plan, entry, 'move', {
          position: indexOf(entry) + 1,
        }),
      isVisible: (entry) =>
        canReorder(entry) && indexOf(entry) < plan.entries.length - 1,
    },
    {
      id: 'pin',
      label: 'Pin',
      icon: Pin,
      variant: 'outline',
      run: (entry) => adjustEntry(runtime, plan, entry, 'pin'),
      isVisible: (entry) => canReorder(entry) && !entry.pinned,
    },
    {
      id: 'unpin',
      label: 'Unpin',
      icon: PinOff,
      variant: 'outline',
      run: (entry) => adjustEntry(runtime, plan, entry, 'pin'),
      isVisible: (entry) => canReorder(entry) && entry.pinned,
    },
  ]
}
