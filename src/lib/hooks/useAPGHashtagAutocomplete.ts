import { useCallback } from 'react'
import { useStore } from '@/store'
import type { Area, Goal, Project } from '@c/types'
import {
  useAutocomplete,
  type AutocompleteOption,
  type UseAutocompleteResult,
} from '@/lib/hooks/useAutocomplete'
import {
  HydratedArea,
  HydratedGoal,
  HydratedProject,
} from '@d/database/repositories'

export type APGSuggestionKind = 'area' | 'project' | 'goal'

export interface APGSuggestion extends AutocompleteOption {
  kind: APGSuggestionKind
  entity: Area['Read'] | Project['Read'] | Goal['Read']
}

type AnyAPG = Area['Read'] | Project['Read'] | Goal['Read']

const tagForEntity = (
  entity: AnyAPG,
  kind: APGSuggestionKind,
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

// Mirrors the `#\S+` hashtag grammar so a title without a tag can still be
// inserted as a valid hashtag.
const slugifyTag = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const toSuggestion = (
  entity: AnyAPG,
  kind: APGSuggestionKind,
): APGSuggestion => ({
  id: `${kind}:${entity.id}`,
  label: entity.title,
  insertText: tagForEntity(entity, kind) || slugifyTag(entity.title),
  hint: kind,
  kind,
  entity,
  additionalInfo: `#${tagForEntity(entity, kind)}`,
})

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
 * `#` autocomplete for areas, projects and goals, backed by the entity stores'
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

  const getSuggestions = useCallback(
    async (rawQuery: string): Promise<APGSuggestion[]> => {
      const query = rawQuery.trim().toLowerCase()

      // With nothing typed after the `#`, surface entities already in the store
      // so the dropdown is useful immediately.
      if (!query) {
        return [
          ...projects.data.map((p) => toSuggestion(p, 'project')),
          ...areas.data.map((a) => toSuggestion(a, 'area')),
          ...goals.data.map((g) => toSuggestion(g, 'goal')),
        ].slice(0, maxSuggestions)
      }

      const [projectResults, areaResults, goalResults] = await Promise.all([
        projects.search(query),
        areas.search(query),
        goals.search(query),
      ])

      return [
        ...(projectResults ?? []).map((p) => toSuggestion(p, 'project')),
        ...(areaResults ?? []).map((a) => toSuggestion(a, 'area')),
        ...(goalResults ?? []).map((g) => toSuggestion(g, 'goal')),
      ].slice(0, maxSuggestions)
    },
    [areas, projects, goals, maxSuggestions],
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
