import { useState, useEffect, useCallback } from 'react'
import { Task } from '@c/index'
import { TasksService } from '@/services/TasksService'

export const useTasks = () => {
  const [tasks, setTasks] = useState<Task['Read'][]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true)
      const data = await TasksService.fetchTasks()
      setTasks(data)
      setError(null)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [])

  const createTask = async (task: Task['Write']) => {
    try {
      const newTask = await TasksService.createTask(task)
      setTasks((prev) => [...prev, newTask])
      return newTask
    } catch (err) {
      setError(err as Error)
      throw err
    }
  }

  const updateTask = async (id: string, updates: Task['Update']) => {
    try {
      const updated = await TasksService.updateTask(id, updates)
      if (updated) {
        setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)))
      }
      return updated
    } catch (err) {
      setError(err as Error)
      throw err
    }
  }

  const deleteTask = async (id: string) => {
    try {
      await TasksService.deleteTask(id)
      setTasks((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      setError(err as Error)
      throw err
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  return {
    tasks,
    loading,
    error,
    refetch: fetchTasks,
    createTask,
    updateTask,
    deleteTask,
  }
}
