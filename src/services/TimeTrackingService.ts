// import { dbService } from '@/services/dbService'

// export class TimeTrackingService {
//   private activeTimerId: string | null = null

//   // Start tracking time for a task
//   async startTracking(taskId: string): Promise<string> {
//     if (this.activeTimerId) {
//       await this.stopTracking()
//     }

//     const startTime = Date.now()
//     this.activeTimerId = taskId

//     // Create a new time entry? Or just track in memory?
//     // Usually best to create an entry immediately or on stop.
//     // Optimistic approach: We just track start time.
//     // For robustness, we should store "current_active_task" in DB or localStorage so it survives reload.
//     localStorage.setItem(
//       'active_tracking_task',
//       JSON.stringify({ taskId, startTime }),
//     )

//     return taskId
//   }

//   async stopTracking(): Promise<void> {
//     const active = this.getActiveTracking()
//     if (!active) return

//     const endTime = Date.now()
//     const duration = endTime - active.startTime

//     // Save time entry
//     // Note: We need a TimeEntry repository or use `execute`
//     // Assuming we add TimeEntry to repositories later, for now raw SQL or extend `dbService`
//     // Let's implement TimeEntry support in repositories or here
//     // For now, update the task's total time spent

//     const task = await dbService.tasks.findById(active.taskId)
//     if (task) {
//       await dbService.tasks.update(active.taskId, {
//         time_spent: (task.time_spent || 0) + Math.floor(duration / 1000),
//       })
//     }

//     // Clear active tracking
//     this.activeTimerId = null
//     localStorage.removeItem('active_tracking_task')
//   }

//   getActiveTracking(): { taskId: string; startTime: number } | null {
//     const stored = localStorage.getItem('active_tracking_task')
//     return stored ? JSON.parse(stored) : null
//   }
// }

// export const timeTrackingService = new TimeTrackingService()
