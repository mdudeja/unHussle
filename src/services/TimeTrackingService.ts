import { TasksService } from '@/services/TasksService'

export class TimeTrackingService {
  private activeTimerId: string | null = null

  // Start tracking time for a task
  async startTracking(taskId: string): Promise<string> {
    if (this.activeTimerId) {
      await this.stopTracking()
    }

    const startTime = Date.now()
    this.activeTimerId = taskId

    // Persist active timer to localStorage
    localStorage.setItem(
      'active_tracking_task',
      JSON.stringify({ taskId, startTime }),
    )

    return taskId
  }

  async stopTracking(): Promise<void> {
    const active = this.getActiveTracking()
    if (!active) return

    const endTime = Date.now()
    const durationMs = endTime - active.startTime
    // Convert to minutes for 'spent_minutes' in DB (since schema is integer minutes)
    // OR seconds? Schema says 'spent_minutes'. Let's assume minutes.
    // If schema was 'spent_seconds' we'd be more precise.
    // Wait, TasksSchema spent_minutes: integer.
    // Let's stick to minutes, but maybe we should accumulate seconds in future.
    // For now, let's just add the minutes elapsed.

    // Better strategy: Fetch current task, add delta.
    try {
      const task = await TasksService.getInstance().fetchById(active.taskId)
      if (task) {
        const minutesToAdd = Math.ceil(durationMs / 1000 / 60)

        await TasksService.getInstance().update(active.taskId, {
          spent_minutes: (task.spent_minutes || 0) + minutesToAdd,
        })
      }
    } catch (e) {
      console.error('Failed to update task time', e)
    }

    // Clear active tracking
    this.activeTimerId = null
    localStorage.removeItem('active_tracking_task')
  }

  getActiveTracking(): { taskId: string; startTime: number } | null {
    const stored = localStorage.getItem('active_tracking_task')
    return stored ? JSON.parse(stored) : null
  }
}

export const timeTrackingService = new TimeTrackingService()
