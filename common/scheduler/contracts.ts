import type {
  Task,
  Project,
  Goal,
  Area,
  ProgressStatus,
  SchedulerDayPlan,
  TaskOccurrence,
  TimeEntry,
} from '@c/types'

export const scheduleCues = ['fresh', 'break', 'wrap', 'more'] as const
export type ScheduleCue = (typeof scheduleCues)[number]

export const planRuleNames = [
  // Pickers: each claims candidates in its own order; earlier rules win capacity.
  'keepActive',
  'preScheduled',
  'recurringOccurrences',
  'urgentCandidates',
  'resumePaused',
  'dueSoon',
  'priorityRanking',
  'dueDateRanking',
  'oldestFirst',
  'wrapChores',
  // Arrangers: reorder the stack without changing its membership.
  'starterTask',
  'easyReturn',
  'quickOrFunBetweenLong',
  'choresLast',
  'restorePins',
] as const
export type PlanRuleName = (typeof planRuleNames)[number]
export type PlanRuleRegistry = Record<ScheduleCue, PlanRuleName[]>

export type SchedulerWindow = { wake: string; sleep: string }

export type SchedulerSettings = SchedulerWindow & {
  workTags: string[]
  workMinutes: number
  defaultMinutes: number
  quickMinutes: number
  starterMinutes: number
  longMinutes: number
  /** How long before wind-down, or before the last task ends, wrap-up starts. */
  wrapMinutes: number
  overrides: Record<string, SchedulerWindow & { workMinutes?: number }>
  /** Per-cue rule order, merged over the default registry. */
  rules?: Partial<PlanRuleRegistry>
}

export const defaultSchedulerSettings: SchedulerSettings = {
  wake: '07:00',
  sleep: '23:00',
  workTags: ['work'],
  workMinutes: 480,
  defaultMinutes: 30,
  quickMinutes: 5,
  starterMinutes: 15,
  longMinutes: 45,
  wrapMinutes: 30,
  overrides: {},
}

type TaskRead = Task['Read']
type OccurrenceRead = TaskOccurrence['Read']

export type SchedulerTask = TaskRead & {
  collectionPriorities: [
    Project['Read']['priority'],
    Goal['Read']['priority'],
    Area['Read']['priority'],
  ]
  isWork: boolean
}
export type OccurrenceState = OccurrenceRead

/** A task or recurring occurrence as the scheduler sees it on one day. */
export type PlanEntry = {
  /** The occurrence id for recurring tasks, otherwise the task id. */
  id: string
  taskId: TaskRead['id']
  taskData: TaskRead['custom_data']
  occurrenceId: OccurrenceRead['id'] | null
  title: TaskRead['title']
  status: OccurrenceRead['status']
  /** Estimated minutes still remaining. */
  minutes: number
  spentMinutes: OccurrenceRead['spentMinutes']
  isWork: boolean
  isFun: TaskRead['is_fun']
  isChore: TaskRead['is_chore']
  isQuick: TaskRead['is_quick']
  fixedStart: number | null
  fixedEnd: number | null
  windowStart: number | null
  windowEnd: number | null
  due: TaskRead['due_date']
  anchorId: TaskRead['anchor_id']
  anchorType: TaskRead['anchor_type']
  anchorSlot: TaskRead['anchor_slot']
  anchorSatisfied?: boolean
  /** Task, project, goal and area priority. */
  priorities: [TaskRead['priority'], ...SchedulerTask['collectionPriorities']]
  createdAt: TaskRead['created_at']
  pinned: boolean
  reason: string
  startedAt?: number
}

export type DayPlan = Omit<SchedulerDayPlan['Read'], 'id'> & {
  entries: PlanEntry[]
  saved: boolean
  workUsed: number
  workPlanned: number
  capacityMinutes: number
  backlogCount: number
  settings: SchedulerSettings
}

type PlanInput = Pick<DayPlan, 'date' | 'timezone'> &
  Partial<Pick<DayPlan, 'revision'>> & {
    operationId?: string
  }
/** Why a day is wrapping up: chosen by the user, or started automatically. */
export const wrapReasons = ['manual', 'lastTask', 'windDown'] as const
export type WrapReason = (typeof wrapReasons)[number]
export const dayModeChanges = ['startBreak', 'endBreak', 'startWrap'] as const
export type DayModeChange = (typeof dayModeChanges)[number]

export const adjustActions = ['later', 'defer', 'pin', 'move'] as const
export type AdjustAction = (typeof adjustActions)[number]
export type SchedulerCommands = {
  'scheduler.generate': { input: PlanInput; result: DayPlan }
  'scheduler.replan': {
    input: PlanInput & { cue?: ScheduleCue }
    result: DayPlan
  }
  'scheduler.adjust': {
    input: PlanInput & {
      itemId: PlanEntry['id']
      action: AdjustAction
      until?: string
      position?: number
    }
    result: DayPlan
  }
  'scheduler.mode.change': {
    input: PlanInput & { change: DayModeChange; reason?: WrapReason }
    result: DayPlan
  }
  'scheduler.settings.change': {
    input: { settings: SchedulerSettings; operationId?: string }
    result: SchedulerSettings
  }
  'occurrence.transition': {
    input: {
      id: OccurrenceState['id']
      status: ProgressStatus
      operationId?: string
    }
    result: OccurrenceState
  }
  /** Closes a running interval at the time the user says they stopped. */
  'tracking.stop': {
    input: {
      taskId: TimeEntry['Read']['task_id']
      occurrenceId: TimeEntry['Read']['occurrence_id']
      at: number
      operationId?: string
    }
    result: TimeEntry['Read']
  }
}
export type SchedulerEvent = {
  operationId: string
  date?: string
  revision?: number
}
export type SchedulerEvents = {
  'scheduler.changed': SchedulerEvent
  'scheduler.mode.changed': SchedulerEvent
  'scheduler.settings.changed': SchedulerEvent
  'occurrence.changed': SchedulerEvent
  'tracking.stopped': SchedulerEvent
}

/** The event each scheduler command publishes after it commits. */
export const schedulerCommandEvents = {
  'scheduler.generate': 'scheduler.changed',
  'scheduler.replan': 'scheduler.changed',
  'scheduler.adjust': 'scheduler.changed',
  'scheduler.mode.change': 'scheduler.mode.changed',
  'scheduler.settings.change': 'scheduler.settings.changed',
  'occurrence.transition': 'occurrence.changed',
  'tracking.stop': 'tracking.stopped',
} as const satisfies Record<keyof SchedulerCommands, keyof SchedulerEvents>

export const schedulerCommandNames = Object.keys(
  schedulerCommandEvents,
) as (keyof SchedulerCommands)[]
