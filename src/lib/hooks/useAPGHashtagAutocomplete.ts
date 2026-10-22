import { useCallback } from 'react'
import { useStore } from '@/store'
import type { Area, Goal, Project, Tag } from '@c/types'
import {
  useAutocomplete,
  type AutocompleteOption,
  type UseAutocompleteResult,
} from '@/lib/hooks/useAutocomplete'
import { slugifyTag } from '@/lib/inputParsers/parseHashtags'
import {
  HydratedArea,
  HydratedGoal,
  HydratedProject,
} from '@d/database/repositories'

export type APGSuggestionKind = 'area' | 'project' | 'goal' | 'tag'

export interface APGSuggestion extends AutocompleteOption {
  kind: APGSuggestionKind
  entity: Area['Read'] | Project['Read'] | Goal['Read'] | Tag['Read']
}

type AnyAPG = Area['Read'] | Project['Read'] | Goal['Read']

const tagForEntity = (
  entity: AnyAPG,
  kind: Exclude<APGSuggestionKind, 'tag'>,
): string | undefined => {
  switch (kind) {
    case 'area':
      return (entity as HydratedArea).tags?.[0]?.title ?? undefined
    case 'project':
      return (entity as HydratedProject).tags?.[0]?.title ?? undefined
    case 'goal':
      return (entity as HydratedGoal).tags?.[0]?.title ?? undefined
  }
}

const toSuggestion = (
  entity: AnyAPG,
  kind: Exclude<APGSuggestionKind, 'tag'>,
): APGSuggestion => ({
  id: `${kind}:${entity.id}`,
  label: entity.title,
  insertText: tagForEntity(entity, kind) || slugifyTag(entity.title),
  hint: kind,
  kind,
  entity,
  additionalInfo: `#${tagForEntity(entity, kind)}`,
})

const toTagSuggestion = (tag: Tag['Read']): APGSuggestion => ({
  id: `tag:${tag.id}`,
  label: `#${tag.title}`,
  insertText: tag.title,
  hint: 'tag',
  kind: 'tag',
  entity: tag,
})

// Plain tags, minus those attached to an area/project/goal: `parseHashtags`
// resolves those to the entity, so offering them as tags would be ambiguous.
const plainTagSuggestions = (
  tags: Tag['Read'][],
  entities: AnyAPG[],
): APGSuggestion[] => {
  const entityTags = new Set(
    entities.flatMap(
      (entity) =>
        (entity as HydratedArea).tags?.map((tag) => tag.title.toLowerCase()) ??
        [],
    ),
  )
  return tags
    .filter((tag) => !entityTags.has(tag.title.toLowerCase()))
    .map(toTagSuggestion)
}

export interface UseAPGHashtagAutocompleteOptions {
  /** Controlled value of the input or textarea. */
  inputValue: string
  /** Called with the chosen entity and the updated input value. */
  onSelect: (suggestion: APGSuggestion, nextInputValue: string) => void
  maxSuggestions?: number
  debounceMs?: number
  enabled?: boolean
}

/**
 * `#` autocomplete for areas, projects, goals and plain tags, backed by the entity stores'
 * `search` methods. Built on top of the generic `useAutocomplete` hook.
 */
export const useAPGHashtagAutocomplete = ({
  inputValue,
  onSelect,
  maxSuggestions = 15,
  debounceMs = 150,
  enabled = true,
}: UseAPGHashtagAutocompleteOptions): UseAutocompleteResult<APGSuggestion> => {
  const areas = useStore((state) => state.areas)
  const projects = useStore((state) => state.projects)
  const goals = useStore((state) => state.goals)
  const tags = useStore((state) => state.tags)

  const getSuggestions = useCallback(
    async (rawQuery: string): Promise<APGSuggestion[]> => {
      const query = rawQuery.trim().toLowerCase()

      // With nothing typed after the `#`, surface entities already in the store
      // so the dropdown is useful immediately.
      const storeEntities = [...projects.data, ...areas.data, ...goals.data]

      if (!query) {
        return [
          ...projects.data.map((p) => toSuggestion(p, 'project')),
          ...areas.data.map((a) => toSuggestion(a, 'area')),
          ...goals.data.map((g) => toSuggestion(g, 'goal')),
          ...plainTagSuggestions(tags.data, storeEntities),
        ].slice(0, maxSuggestions)
      }

      const [projectResults, areaResults, goalResults, tagResults] =
        await Promise.all([
          projects.search(query),
          areas.search(query),
          goals.search(query),
          tags.search(query),
        ])

      return [
        ...(projectResults ?? []).map((p) => toSuggestion(p, 'project')),
        ...(areaResults ?? []).map((a) => toSuggestion(a, 'area')),
        ...(goalResults ?? []).map((g) => toSuggestion(g, 'goal')),
        ...plainTagSuggestions(tagResults ?? [], [
          ...storeEntities,
          ...(projectResults ?? []),
          ...(areaResults ?? []),
          ...(goalResults ?? []),
        ]),
      ].slice(0, maxSuggestions)
    },
    [areas, projects, goals, tags, maxSuggestions],
  )

  return useAutocomplete<APGSuggestion>({
    inputValue,
    getSuggestions,
    onSelect,
    enabled,
    maxSuggestions,
    debounceMs,
    trigger: '#',
  })
}
