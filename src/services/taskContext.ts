import type { TaskContext } from '@c/types/Hydrated'
import { makeJSONRequest } from '@/lib/server'

const base = `http://localhost:${import.meta.env.VITE_DB_SERVER_PORT || '3456'}`

/** A task's own and inherited resources, links and tags. */
export const fetchTaskContext = (taskId: string) =>
  makeJSONRequest<TaskContext>({
    url: `${base}/tasks/${encodeURIComponent(taskId)}/context`,
    method: 'GET',
  })
