import { Hotkey, HotkeyModifier } from '@/store/slices/createUISlice'

export type HotkeyDefinition = Omit<Hotkey, 'callback' | 'target'> & {
  /** Where the hotkey works; the shortcuts page groups by it. */
  scope: HotkeyScope
}

/** Display order of the shortcuts page sections. */
export const HOTKEY_SCOPES = [
  'Anywhere',
  'Next task',
  'Brain dump',
  'Resource title',
  'Developer tools',
] as const
export type HotkeyScope = (typeof HOTKEY_SCOPES)[number]

/** Every hotkey in the app, including those whose component is not mounted. */
export const HOTKEYS = {
  'sidebar.toggle': {
    id: 'sidebar.toggle',
    scope: 'Anywhere',
    title: 'Toggle sidebar',
    description: 'Opens or closes the sidebar.',
    key: 'b',
    modifier: ['Control', 'Meta'],
  },
  'app.home': {
    id: 'app.home',
    scope: 'Anywhere',
    title: 'Go home',
    description: 'Goes back to the next task.',
    key: 'h',
    modifier: ['Shift', 'Control'],
  },
  'next-task.start': {
    id: 'next-task.start',
    scope: 'Next task',
    title: 'Start',
    description: 'Starts the task.',
    key: 's',
  },
  'next-task.pause': {
    id: 'next-task.pause',
    scope: 'Next task',
    title: 'Pause',
    description: 'Pauses the running task.',
    key: 'p',
  },
  'next-task.done': {
    id: 'next-task.done',
    scope: 'Next task',
    title: 'Done',
    description: 'Marks the task as done.',
    key: 'd',
  },
  'next-task.skip': {
    id: 'next-task.skip',
    scope: 'Next task',
    title: 'Do something else',
    description: 'Sets the task aside and shows the next one.',
    key: 'n',
  },
  'next-task.later': {
    id: 'next-task.later',
    scope: 'Next task',
    title: 'Later today',
    description: 'Moves the task later in the day.',
    key: 'l',
  },
  'next-task.another-day': {
    id: 'next-task.another-day',
    scope: 'Next task',
    title: 'Another day',
    description:
      'Moves the task to another day, or skips this occurrence of a recurring task.',
    key: 'a',
  },
  'next-task.edit': {
    id: 'next-task.edit',
    scope: 'Next task',
    title: 'Edit',
    description: 'Opens the task editor.',
    key: 'e',
  },
  'next-task.details': {
    id: 'next-task.details',
    scope: 'Next task',
    title: 'Open task page',
    description: 'Goes to the task’s page.',
    key: 'o',
  },
  'next-task.resources': {
    id: 'next-task.resources',
    scope: 'Next task',
    title: 'Show resources',
    description: 'Shows the task’s resources, if it has any.',
    key: 'r',
  },
  'next-task.break': {
    id: 'next-task.break',
    scope: 'Next task',
    title: 'Take or end a break',
    description: 'Starts a break, or ends the current one.',
    key: 'b',
  },
  'next-task.wrap': {
    id: 'next-task.wrap',
    scope: 'Next task',
    title: 'Wrap up',
    description: 'Switches to chores for the rest of the day.',
    key: 'w',
  },
  'next-task.reschedule': {
    id: 'next-task.reschedule',
    scope: 'Next task',
    title: 'Reschedule',
    description: 'Plans a fresh stack for the rest of the day.',
    key: 'r',
    modifier: 'Shift',
  },
  'brain-dump.submit': {
    id: 'brain-dump.submit',
    scope: 'Brain dump',
    title: 'Save brain dump',
    description: 'Saves the brain dump as a task.',
    key: 'Enter',
    modifier: ['Control', 'Meta'],
  },
  'brain-dump.cancel': {
    id: 'brain-dump.cancel',
    scope: 'Brain dump',
    title: 'Cancel brain dump',
    description: 'Clears the brain dump.',
    key: 'Escape',
  },
  'resource.title.save': {
    id: 'resource.title.save',
    scope: 'Resource title',
    title: 'Save resource title',
    description: 'Saves the new title.',
    key: 'Enter',
  },
  'resource.title.revert': {
    id: 'resource.title.revert',
    scope: 'Resource title',
    title: 'Revert resource title',
    description: 'Restores the saved title.',
    key: 'Escape',
  },
  'workflow-inspector.toggle': {
    id: 'workflow-inspector.toggle',
    scope: 'Developer tools',
    title: 'Toggle workflow inspector',
    description: 'Opens or closes the workflow inspector panel.',
    key: 'o',
    modifier: ['Control', 'Shift'],
    modifierMode: 'all',
  },
} satisfies Record<string, HotkeyDefinition>

export type HotkeyId = keyof typeof HOTKEYS

export const HOTKEY_BUSY_MESSAGE = 'Wait for the current action to finish.'

/** Handled by `NextTaskFocus`; the card explains them while no task is shown. */
export const TASK_HOTKEY_IDS: HotkeyId[] = [
  'next-task.start',
  'next-task.pause',
  'next-task.done',
  'next-task.skip',
  'next-task.later',
  'next-task.another-day',
  'next-task.edit',
  'next-task.details',
  'next-task.resources',
]

const IS_MAC = navigator.userAgent.includes('Mac')

const MODIFIER_LABELS: Record<HotkeyModifier, string> = {
  Alt: IS_MAC ? 'Option' : 'Alt',
  Control: 'Ctrl',
  Meta: IS_MAC ? 'Cmd' : 'Meta',
  Shift: 'Shift',
}

const KEY_LABELS: Record<string, string> = { Escape: 'Esc' }

/**
 * Returns the key combinations that trigger a hotkey, as key labels.
 * An `any` hotkey with several modifiers yields one combination per modifier.
 */
export function formatHotkey(hotkey: HotkeyDefinition): string[][] {
  const key =
    KEY_LABELS[hotkey.key] ??
    (hotkey.key.length === 1 ? hotkey.key.toUpperCase() : hotkey.key)
  const modifiers = [hotkey.modifier ?? []]
    .flat()
    .map((modifier) => MODIFIER_LABELS[modifier])
  if (modifiers.length === 0) {
    return [[key]]
  }
  return hotkey.modifierMode === 'all'
    ? [[...modifiers, key]]
    : modifiers.map((modifier) => [modifier, key])
}
