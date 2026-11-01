import type {
  PlanRuleName,
  PlanRuleRegistry,
  ScheduleCue,
  SchedulerSettings,
} from './contracts'

// Earlier pickers win capacity first, so this order is the user's workload
// preference: commitments, then urgency, then priority, due date and age.
const pickers = [
  'keepActive',
  'preScheduled',
  'recurringOccurrences',
  'urgentCandidates',
  'dueSoon',
  'priorityRanking',
  'dueDateRanking',
  'oldestFirst',
] as const satisfies PlanRuleName[]

// Arrangers only reorder what the pickers placed.
const pause = ['shortChore', 'quickOrFunBetweenLong', 'restorePins'] as const

export const planRuleRegistry: PlanRuleRegistry = {
  fresh: [
    ...pickers,
    'starterTask',
    'quickOrFunBetweenLong',
    'choresLast',
    'restorePins',
  ],
  break: [...pickers, ...pause],
  wrap: [...pickers, ...pause],
  more: [...pickers, 'quickOrFunBetweenLong', 'choresLast', 'restorePins'],
}

/** A user override replaces the rule list of the cue it names. */
export const rulesFor = (
  cue: ScheduleCue,
  settings: Pick<SchedulerSettings, 'rules'>,
  registry: PlanRuleRegistry = planRuleRegistry,
): PlanRuleName[] => settings.rules?.[cue] ?? registry[cue]
