import { useState, useEffect, useCallback } from 'react'
import { Task } from '../types'
import { dbService } from '../services/dbService'

export const useTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true)
      const data = await dbService.tasks.findAll()
      setTasks(data)
      setError(null)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [])

  const createTask = async (task: Partial<Task>) => {
    try {
      const newTask = await dbService.tasks.create(task as any) // Type assertion needed for partial
      setTasks((prev) => [...prev, newTask])
      return newTask
    } catch (err) {
      setError(err as Error)
      throw err
    }
  }

  const updateTask = async (id: string, updates: Partial<Task>) => {
    try {
      const updated = await dbService.tasks.update(id, updates)
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
      await dbService.tasks.delete(id)
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
