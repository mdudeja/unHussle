import {
  pickerRules,
  arrangerRules,
  type PlanRuleName,
  PlanRuleRegistry,
  type ScheduleCue,
  type SchedulerSettings,
} from './contracts'
import { arrayWithout } from './helpers'

// Earlier pickers win capacity first, so this order is the user's workload
// preference: commitments, then urgency, then work already started, then
// priority, due date and age.
const basePickers = [
  ...arrayWithout<PlanRuleName>({
    list: pickerRules,
    exclude: ['wrapChores'],
  }),
] as const satisfies PlanRuleName[]

export const planRuleRegistry: PlanRuleRegistry = {
  fresh: [
    ...basePickers,
    ...arrayWithout<PlanRuleName>({
      list: arrangerRules,
      exclude: ['easyReturn'],
    }),
  ],
  // Planned when a break starts, so the stack is ready on return.
  break: [
    ...basePickers,
    ...arrayWithout<PlanRuleName>({
      list: arrangerRules,
      exclude: ['starterTask'],
    }),
  ],
  // Wrapping up keeps commitments and active work, then only chores.
  wrap: ['keepActive', 'preScheduled', 'wrapChores', 'restorePins'],
  more: [
    ...basePickers,
    ...arrayWithout<PlanRuleName>({
      list: arrangerRules,
      exclude: ['starterTask', 'easyReturn'],
    }),
  ],
}

/** A user override replaces the rule list of the cue it names. */
export const rulesFor = (
  cue: ScheduleCue,
  settings: Pick<SchedulerSettings, 'rules'>,
  registry: PlanRuleRegistry = planRuleRegistry,
): PlanRuleName[] => settings.rules?.[cue] ?? registry[cue]
