import { Priority } from '@c/types/enums'
import { Task } from '@c/types/index'
import { Area, Goal, Project, Tag, Url } from '@d/database/schemas'
import { parseUrl } from '@/lib/inputParsers/parseUrl'
import { parseHashtags } from '@/lib/inputParsers/parseHashtags'
import { parseDueDate } from '@/lib/inputParsers/parseDueDate'

export interface ParsedData {
  task: Task['Write']
  urls: Url['Write'][]
  tags: Tag['Write'][]
}

// Captures the whole "due ..." expression up to the end of the text; the
// estimate is stripped before this runs so it is not swallowed.
const dueDateRegex = /\bdue\s+(.*)$/i
const estimatedTimeRegex =
  /\b(?:est|et):\s*(\d+(?:\.\d+)?)\s*(hours?|h|minutes?|mins?|m)(?:\s*(\d+(?:\.\d+)?)\s*(minutes?|mins?|m))?/gi

const toMinutes = (value: number, unit: string): number => {
  const normalized = unit.toLowerCase()
  if (normalized.startsWith('h')) {
    return value * 60
  }
  if (normalized.startsWith('m')) {
    return value
  }
  return 0
}

export const parseDataFromTaskInput = ({
  input,
  projects,
  areas,
  goals,
}: {
  input: string
  projects: Project['Read'][]
  areas: Area['Read'][]
  goals: Goal['Read'][]
}): ParsedData => {
  const { urls, textMinusUrls } = parseUrl(input)

  const { textWithoutTags, area_id, project_id, goal_id, tags } = parseHashtags(
    {
      text: textMinusUrls.trim(),
      existingProjects: projects,
      existingAreas: areas,
      existingGoals: goals,
    },
  )

  let title = textWithoutTags.trim()

  // Estimated time parsing. `matchAll` yields capture groups, unlike
  // `String.match` with a global regex.
  let totalMinutes = 0
  for (const match of title.matchAll(estimatedTimeRegex)) {
    const [, value, unit, value2, unit2] = match
    totalMinutes += toMinutes(parseFloat(value), unit)
    if (value2 && unit2) {
      totalMinutes += toMinutes(parseFloat(value2), unit2)
    }
    title = title.replace(match[0], '')
  }
  title = title.trim()

  // Due date parsing
  let dueDate: number | undefined
  const dueDateMatch = title.match(dueDateRegex)
  if (dueDateMatch) {
    const parsedDueDate = parseDueDate(dueDateMatch[0])
    if (parsedDueDate) {
      dueDate = parsedDueDate
      title = title.replace(dueDateMatch[0], '').trim()
    }
  }

  const task: Task['Write'] = {
    title: title.replace(/\s+/g, ' ').trim(),
    priority: Priority.MEDIUM,
    area_id,
    project_id,
    goal_id,
  }

  if (totalMinutes > 0) {
    task.estimated_minutes = totalMinutes
  }

  if (dueDate !== undefined) {
    task.due_date = dueDate
  }

  return {
    task,
    urls,
    tags: tags ?? [],
  }
}
