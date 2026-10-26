import { TasksService } from '@/services/database/TasksService'
import { Logger } from '@c/Logger'

export class TimeTrackingService {
  private activeTimerId: string | null = null

  // Start tracking time for a task
  async startTracking(taskId: string): Promise<string> {
    if (this.activeTimerId && this.activeTimerId !== taskId) {
      await this.stopTracking()
    }

    if (this.activeTimerId === taskId) {
      return taskId // Already tracking this task
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
    try {
      const task = await TasksService.getInstance().fetchById(active.taskId)
      if (task) {
        const minutesToAdd = Math.ceil(durationMs / 1000 / 60)

        await TasksService.getInstance().update(active.taskId, {
          spent_minutes: (task.spent_minutes || 0) + minutesToAdd,
        })
      }
    } catch (e) {
      Logger.getInstance().error(`Failed to update task time: ${String(e)}`)
    }

    // Clear active tracking
    this.activeTimerId = null
    localStorage.removeItem('active_tracking_task')
  }

  // Drops the active session without saving its time (e.g. the task is gone).
  discardTracking(): void {
    this.activeTimerId = null
    localStorage.removeItem('active_tracking_task')
  }

  getActiveTracking(): { taskId: string; startTime: number } | null {
    const stored = localStorage.getItem('active_tracking_task')
    return stored
      ? (JSON.parse(stored) as { taskId: string; startTime: number })
      : null
  }
}

export const timeTrackingService = new TimeTrackingService()
