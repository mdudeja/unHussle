import type { EntryKind, EntryRecord } from '@c/workflows/contracts'

/** Multiple containment paths, siblings, an indirect project and an unrelated task. */
export async function createRelationshipFixture(
  create: (
    kind: EntryKind,
    values: Record<string, unknown>,
  ) => Promise<EntryRecord>,
) {
  const tag = await create('tags', { title: 'Baseline membership' })
  const area = await create('areas', {
    title: 'Baseline area',
    tags: [{ id: tag.id, title: tag.title }],
  })
  const goal = await create('goals', {
    title: 'Baseline goal',
    area_id: area.id,
  })
  const project = await create('projects', {
    title: 'Baseline project',
    area_id: area.id,
    goal_id: goal.id,
    tags: [{ id: tag.id, title: tag.title }],
  })
  const sibling = await create('projects', {
    title: 'Baseline sibling',
    area_id: area.id,
    goal_id: goal.id,
  })
  const indirect = await create('projects', {
    title: 'Baseline indirect project',
    goal_id: goal.id,
  })
  const taskValues = {
    directArea: { area_id: area.id },
    directGoal: { goal_id: goal.id },
    directProject: { project_id: project.id },
    multiplePaths: {
      project_id: project.id,
      goal_id: goal.id,
      area_id: area.id,
      tags: [{ id: tag.id, title: tag.title }],
    },
    sibling: { project_id: sibling.id },
    indirect: { project_id: indirect.id },
    unrelated: {},
  }
  const tasks: Record<string, string> = {}
  for (const [name, values] of Object.entries(taskValues)) {
    tasks[name] = (
      await create('tasks', { title: `Baseline ${name}`, ...values })
    ).id
  }
  return { tag, area, goal, project, tasks }
}
