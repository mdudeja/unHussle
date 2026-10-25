import { Tag } from '@c/types'
import {
  HydratedArea,
  HydratedGoal,
  HydratedProject,
} from '@d/database/repositories'

// Mirrors the `#\S+` hashtag grammar so a title without a tag can still be
// inserted as a valid hashtag.
export const slugifyTag = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

type HashtagParseResult = {
  project_id?: string
  area_id?: string
  goal_id?: string
  tags?: Tag['Write'][]
  textWithoutTags: string
}

export const parseHashtags = ({
  text,
  existingProjects,
  existingAreas,
  existingGoals,
}: {
  text: string
  existingProjects: HydratedProject[]
  existingAreas: HydratedArea[]
  existingGoals: HydratedGoal[]
}): HashtagParseResult => {
  const result: HashtagParseResult = {
    textWithoutTags: text,
  }
  // Captures the whole hashtag body (everything up to the next whitespace),
  // whether or not it is followed by more text.
  const hashtagRegex = /(?<=#)\S+/g
  const hashtags = text.match(hashtagRegex) || []

  const tagsSet = new Set<string>()

  for (const tag of hashtags) {
    const tagName = tag.trim().toLowerCase()
    // Remove the hashtag including its `#`, using the original casing.
    result.textWithoutTags = result.textWithoutTags.replace(`#${tag}`, '')

    // Check if it's an existing project, area, goal, or tag
    const matchedProject = existingProjects.find(
      (p) =>
        p.title.toLowerCase() === tagName ||
        p.title.toLowerCase() === tagName.replace(/_/g, ' ') ||
        p.tags?.some((t) => t.title.toLowerCase() === tagName),
    )
    const matchedArea = existingAreas.find(
      (a) =>
        a.title.toLowerCase() === tagName ||
        a.title.toLowerCase() === tagName.replace(/_/g, ' ') ||
        a.tags?.some((t) => t.title.toLowerCase() === tagName),
    )
    const matchedGoal = existingGoals.find(
      (g) =>
        g.title.toLowerCase() === tagName ||
        g.title.toLowerCase() === tagName.replace(/_/g, ' ') ||
        g.tags?.some((t) => t.title.toLowerCase() === tagName),
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
