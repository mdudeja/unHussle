import type { MutationInput } from '@c/workflows/contracts'
import type { MutationOptions } from '@/services/database/DbService'
import type { EntryTransport } from './contracts'

/** Command families the backend routes expose (`entry.*` is backend-internal). */
export const mutationHeads = [
  'entity',
  'entityCollection',
  'entitySupporter',
] as const

/** How each command verb is sent to the backend. */
export const mutationVerbs = {
  add: (service, { changes = {} }, options) => service.create(changes, options),
  change: (service, { id, changes = {} }, options) => {
    if (!id) throw new Error('Missing id for change command')
    return service.update(id, changes, options)
  },
  delete: (service, { id }, options) => {
    if (!id) throw new Error('Missing id for delete command')
    return service.delete(id, options)
  },
  deleteAll: (service, _input, options) => service.reset(options),
} satisfies Record<
  string,
  (
    service: EntryTransport,
    input: MutationInput,
    options: MutationOptions,
  ) => Promise<unknown>
>

export type MutationVerb = keyof typeof mutationVerbs
