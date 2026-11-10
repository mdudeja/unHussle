import { useCallback } from 'react'
import { useEntityReferences } from './useEntityReferences'
import { fetchReferences } from '@/services/readModels'
import type { EntityReference } from '@c/types/readModels'
import {
  useAutocomplete,
  type AutocompleteOption,
  type UseAutocompleteResult,
} from '@/lib/hooks/useAutocomplete'
import { slugifyTag } from '@/lib/inputParsers/parseHashtags'

export type APGSuggestionKind = 'area' | 'project' | 'goal' | 'tag'

export interface APGSuggestion extends AutocompleteOption {
  kind: APGSuggestionKind
  entity: EntityReference
}

type AnyAPG = EntityReference

const tagForEntity = (
  entity: AnyAPG,
  kind: Exclude<APGSuggestionKind, 'tag'>,
): string | undefined => {
  switch (kind) {
    case 'area':
      return entity.tags?.[0]?.title ?? undefined
    case 'project':
      return entity.tags?.[0]?.title ?? undefined
    case 'goal':
      return entity.tags?.[0]?.title ?? undefined
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

const toTagSuggestion = (tag: EntityReference): APGSuggestion => ({
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
  tags: EntityReference[],
  entities: AnyAPG[],
): APGSuggestion[] => {
  const entityTags = new Set(
    entities.flatMap(
      (entity) => entity.tags?.map((tag) => tag.title.toLowerCase()) ?? [],
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
 * `#` autocomplete for areas, projects, goals and plain tags, backed by lightweight
 * reference reads. Built on top of the generic `useAutocomplete` hook.
 */
export const useAPGHashtagAutocomplete = ({
  inputValue,
  onSelect,
  maxSuggestions = 15,
  debounceMs = 150,
  enabled = true,
}: UseAPGHashtagAutocompleteOptions): UseAutocompleteResult<APGSuggestion> => {
  const areas = useEntityReferences('areas', enabled)
  const projects = useEntityReferences('projects', enabled)
  const goals = useEntityReferences('goals', enabled)
  const tags = useEntityReferences('tags', enabled)

  const getSuggestions = useCallback(
    async (rawQuery: string): Promise<APGSuggestion[]> => {
      const query = rawQuery.trim().toLowerCase()

      // Empty queries use the shared reference cache.
      const referenceEntities = [...projects.data, ...areas.data, ...goals.data]

      if (!query) {
        return [
          ...projects.data.map((p) => toSuggestion(p, 'project')),
          ...areas.data.map((a) => toSuggestion(a, 'area')),
          ...goals.data.map((g) => toSuggestion(g, 'goal')),
          ...plainTagSuggestions(tags.data, referenceEntities),
        ].slice(0, maxSuggestions)
      }

      const [projectResults, areaResults, goalResults, tagResults] =
        await Promise.all([
          fetchReferences('projects', { q: query, limit: maxSuggestions }).then(
            (page) => page.items,
          ),
          fetchReferences('areas', { q: query, limit: maxSuggestions }).then(
            (page) => page.items,
          ),
          fetchReferences('goals', { q: query, limit: maxSuggestions }).then(
            (page) => page.items,
          ),
          fetchReferences('tags', { q: query, limit: maxSuggestions }).then(
            (page) => page.items,
          ),
        ])

      return [
        ...(projectResults ?? []).map((p) => toSuggestion(p, 'project')),
        ...(areaResults ?? []).map((a) => toSuggestion(a, 'area')),
        ...(goalResults ?? []).map((g) => toSuggestion(g, 'goal')),
        ...plainTagSuggestions(tagResults ?? [], [
          ...referenceEntities,
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
