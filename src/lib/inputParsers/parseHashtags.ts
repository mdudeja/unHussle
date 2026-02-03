import { Area, Goal, Project, Tag } from '@c/types'

type HashtagParseResult = {
  project_id?: string
  area_id?: string
  goal_id?: string
  tags?: Tag['Write'][]
  hashtagCleanText: string
}

export const parseHashtags = ({
  text,
  existingProjects,
  existingAreas,
  existingGoals,
  cleanText,
}: {
  text: string
  existingProjects: Project['Read'][]
  existingAreas: Area['Read'][]
  existingGoals: Goal['Read'][]
  cleanText: string
}): HashtagParseResult => {
  const result: HashtagParseResult = {
    hashtagCleanText: cleanText,
  }
  const hashtagRegex = /#'([^']+)'/g
  const hashtags = text.match(hashtagRegex) || []

  const tagsSet = new Set<string>()

  for (const tag of hashtags) {
    const tagName = tag.trim().slice(2, -1).toLowerCase()
    result.hashtagCleanText = result.hashtagCleanText.replace(tag, '')

    // Check if it's an existing project, area, goal, or tag
    const matchedProject = existingProjects.find(
      (p) => p.title.toLowerCase() === tagName,
    )
    const matchedArea = existingAreas.find(
      (a) => a.title.toLowerCase() === tagName,
    )
    const matchedGoal = existingGoals.find(
      (g) => g.title.toLowerCase() === tagName,
    )

    if (matchedProject && !result.project_id) {
      result.project_id = matchedProject.id
      continue
    }

    if (matchedArea && !result.area_id) {
      result.area_id = matchedArea.id
      continue
    }

    if (matchedGoal && !result.goal_id) {
      result.goal_id = matchedGoal.id
      continue
    }

    tagsSet.add(tagName)
  }

  if (tagsSet.size > 0) {
    result.tags = Array.from(tagsSet).map((tagName) => {
      return { title: tagName }
    })
  }

  return result
}
