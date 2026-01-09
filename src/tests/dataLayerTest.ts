import { dbService } from '@/services/dbService'
import { TaskPriority, TaskStatus, ProjectStatus } from '@/types'

// Simple assertion helper
const expect = <T>(actual: T) => ({
  toBe: (expected: T) => {
    if (actual !== expected) {
      throw new Error(`Expected ${expected} but got ${actual}`)
    }
  },
  toBeTruthy: () => {
    if (!actual) {
      throw new Error(`Expected ${actual} to be truthy`)
    }
  },
  toBeGreaterThan: (expected: number) => {
    if ((actual as number) <= expected) {
      throw new Error(`Expected ${actual} to be greater than ${expected}`)
    }
  },
  toContain: (item: any) => {
    if (!Array.isArray(actual) || !actual.includes(item)) {
      throw new Error(`Expected array to contain ${item}`)
    }
  },
})

export const runDataLayerTests = async () => {
  console.group('🧪 Running Data Layer Tests')
  const results: { name: string; success: boolean; error?: string }[] = []

  const runTest = async (name: string, testFn: () => Promise<void>) => {
    try {
      console.log(`running: ${name}...`)
      await testFn()
      console.log(`✅ ${name} passed`)
      results.push({ name, success: true })
    } catch (e) {
      console.error(`❌ ${name} failed:`, e)
      results.push({ name: name, success: false, error: (e as Error).message })
    }
  }

  try {
    // 1. Tag Tests
    let tagId: string
    await runTest('Create Tag', async () => {
      const tag = await dbService.tags.create({
        title: 'Test Tag',
        color: '#ff0000',
      })
      expect(tag.title).toBe('Test Tag')
      expect(tag.id).toBeTruthy()
      tagId = tag.id
    })

    // 2. Area Tests
    let areaId: string
    await runTest('Create Area', async () => {
      const area = await dbService.areas.create({
        title: 'Test Area',
        icon: 'folder',
      })
      expect(area.title).toBe('Test Area')
      areaId = area.id
    })

    // 3. Project Tests
    let projectId: string
    await runTest('Create Project Linked to Area', async () => {
      const project = await dbService.projects.create({
        title: 'Test Project',
        status: ProjectStatus.ACTIVE,
        area_id: areaId,
      })
      expect(project.title).toBe('Test Project')
      expect(project.area_id).toBe(areaId)
      projectId = project.id
    })

    // 4. Task Tests
    let taskId: string
    await runTest('Create Task Linked to Project and Tag', async () => {
      // Step 1: Create Task
      const task = await dbService.tasks.create({
        title: 'Test Task',
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        project_id: projectId,
        time_spent: 0,
        is_recurring: false,
        is_fun: false,
        is_chore: false,
        stack_order: 0,
      })

      expect(task.title).toBe('Test Task')
      expect(task.project_id).toBe(projectId)
      taskId = task.id

      // Step 2: Add Tag using repository method
      const tag = await dbService.tags.findById(tagId)
      if (tag) {
        await dbService.tasks.addTags(taskId, [tag])
      } else {
        throw new Error('Tag not found for linking')
      }

      // Verify fetching with tags
      const fetched = await dbService.tasks.findById(taskId)
      expect(fetched).toBeTruthy()
      expect(fetched?.title).toBe('Test Task')

      // TaskRepository findById returns TaskWithTagsAndUrls
      if (fetched && 'tags' in fetched) {
        expect((fetched as any).tags.length).toBeGreaterThan(0)
        expect((fetched as any).tags[0].id).toBe(tagId)
      }
    })

    await runTest('Update Task', async () => {
      const updated = await dbService.tasks.update(taskId, {
        status: TaskStatus.IN_PROGRESS,
      })
      expect(updated?.status).toBe(TaskStatus.IN_PROGRESS)
    })

    await runTest('Delete Task', async () => {
      const success = await dbService.tasks.delete(taskId)
      expect(success).toBe(true)
      const found = await dbService.tasks.findById(taskId)
      if (found) throw new Error('Task should be deleted')
    })

    // Cleanup
    await runTest('Cleanup', async () => {
      await dbService.projects.delete(projectId)
      await dbService.areas.delete(areaId)
      await dbService.tags.delete(tagId)
    })
  } catch (e) {
    console.error('Fatal test error', e)
  } finally {
    console.groupEnd()
    console.table(results)
    return results
  }
}
