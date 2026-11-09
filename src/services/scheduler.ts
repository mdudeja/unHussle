import type {
  DayPlan,
  SchedulerCommands,
  SchedulerSettings,
} from '@c/scheduler/contracts'
import { makeJSONRequest } from '@/lib/server'
import {
  mutationHeaders,
  type MutationOptions,
} from '@/services/database/DbService'

export type SchedulerTransport = {
  day(date: string, timezone: string): Promise<DayPlan>
  week(date: string, timezone: string): Promise<DayPlan[]>
  settings(): Promise<SchedulerSettings>
  execute<K extends keyof SchedulerCommands>(
    name: K,
    input: SchedulerCommands[K]['input'],
    options: MutationOptions,
  ): Promise<SchedulerCommands[K]['result']>
}

const paths: Record<keyof SchedulerCommands, string> = {
  'scheduler.generate': 'generate',
  'scheduler.replan': 'replan',
  'scheduler.adjust': 'adjust',
  'scheduler.mode.change': 'mode',
  'scheduler.settings.change': 'settings',
  'scheduler.occurrence.transition': 'occurrence',
  'scheduler.tracking.stop': 'tracking/stop',
}
const url = (path: string) =>
  `http://localhost:${import.meta.env.VITE_DB_SERVER_PORT || '3456'}/scheduler/${path}`
const read = <T>(path: string, timezone?: string) =>
  makeJSONRequest<T>({
    url: url(
      timezone ? `${path}?timezone=${encodeURIComponent(timezone)}` : path,
    ),
    method: 'GET',
  })

export const schedulerService: SchedulerTransport = {
  day: (date, timezone) => read(`day/${date}`, timezone),
  week: (date, timezone) => read(`week/${date}`, timezone),
  settings: () => read('settings'),
  execute: (name, input, options) =>
    makeJSONRequest({
      url: url(paths[name]),
      ...(name === 'scheduler.settings.change'
        ? {
            method: 'PATCH',
            body: (
              input as SchedulerCommands['scheduler.settings.change']['input']
            ).settings,
          }
        : { method: 'POST', body: input }),
      headers: mutationHeaders(options),
    }),
}
