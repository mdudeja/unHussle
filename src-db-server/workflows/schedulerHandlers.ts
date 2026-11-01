import type {
  SchedulerActionName,
  SchedulerCommand,
} from '@d/workflows/schedulerActions'

const loadDay = ['expireOccurrences', 'loadPlan', 'checkRevision'] as const

/** Ordered actions per scheduler command, like `commandHandlerRegistry`. */
export const schedulerHandlerRegistry: Record<
  SchedulerCommand,
  SchedulerActionName[]
> = {
  'scheduler.generate': [...loadDay, 'keepSaved', 'buildPlan', 'savePlan'],
  'scheduler.replan': [...loadDay, 'buildPlan', 'savePlan'],
  'scheduler.adjust': [...loadDay, 'adjustPlan', 'checkAnchors', 'savePlan'],
  'scheduler.settings.change': ['saveSettings'],
  'occurrence.transition': ['transitionOccurrence', 'trackOccurrenceInterval'],
}
