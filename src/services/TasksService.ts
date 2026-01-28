import { makeJSONRequest } from '@/utils/server'
import { Task } from '@c/index'

const dbUrl = `http://localhost:${import.meta.env.VITE_DB_SERVER_PORT}`

const fetchTasks = async () => {
  return makeJSONRequest<Task['Read'][]>({
    url: `${dbUrl}/tasks`,
    method: 'GET',
  })
}

const fetchTaskById = async (id: string) => {
  return makeJSONRequest<Task['Read']>({
    url: `${dbUrl}/tasks/${id}`,
    method: 'GET',
  })
}

const createTask = async (task: Task['Write']) => {
  return makeJSONRequest<Task['Read']>({
    url: `${dbUrl}/tasks`,
    method: 'POST',
    body: task,
  })
}

const updateTask = async (id: string, task: Task['Update']) => {
  return makeJSONRequest<Task['Read']>({
    url: `${dbUrl}/tasks/${id}`,
    method: 'PATCH',
    body: task,
  })
}

const deleteTask = async (id: string) => {
  return makeJSONRequest<Task['Read']>({
    url: `${dbUrl}/tasks/${id}`,
    method: 'DELETE',
  })
}

export const TasksService = {
  fetchTasks,
  fetchTaskById,
  createTask,
  updateTask,
  deleteTask,
}
