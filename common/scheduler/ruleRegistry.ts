import type {
  PlanRuleName,
  PlanRuleRegistry,
  ScheduleCue,
  SchedulerSettings,
} from './contracts'

// Earlier pickers win capacity first, so this order is the user's workload
// preference: commitments, then urgency, then work already started, then
// priority, due date and age.
const pickers = [
  'keepActive',
  'preScheduled',
  'recurringOccurrences',
  'urgentCandidates',
  'resumePaused',
  'dueSoon',
  'priorityRanking',
  'dueDateRanking',
  'oldestFirst',
] as const satisfies PlanRuleName[]

// Arrangers only reorder what the pickers placed.
export const planRuleRegistry: PlanRuleRegistry = {
  fresh: [
    ...pickers,
    'starterTask',
    'quickOrFunBetweenLong',
    'choresLast',
    'restorePins',
  ],
  // Planned when a break starts, so the stack is ready on return.
  break: [
    ...pickers,
    'easyReturn',
    'quickOrFunBetweenLong',
    'choresLast',
    'restorePins',
  ],
  // Wrapping up keeps commitments and active work, then only chores.
  wrap: ['keepActive', 'preScheduled', 'wrapChores', 'restorePins'],
  more: [...pickers, 'quickOrFunBetweenLong', 'choresLast', 'restorePins'],
}

/** A user override replaces the rule list of the cue it names. */
export const rulesFor = (
  cue: ScheduleCue,
  settings: Pick<SchedulerSettings, 'rules'>,
  registry: PlanRuleRegistry = planRuleRegistry,
): PlanRuleName[] => settings.rules?.[cue] ?? registry[cue]
