import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

/**
 * A single entry rendered in an autocomplete dropdown. Only `id` and `label`
 * are required. `insertText` lets a suggestion display one thing (e.g. an
 * entity title) while inserting another (e.g. its hashtag), and `hint` renders
 * a small right-aligned label (e.g. the entity kind).
 */
export interface AutocompleteOption {
  id: string
  label: string
  insertText?: string
  hint?: string
  additionalInfo?: string
}

export interface AutocompleteToken {
  /** Index of the trigger character. */
  start: number
  /** Index just past the token (currently the end of the value). */
  end: number
  /** Text typed after the trigger character. */
  query: string
}

/**
 * Locates the token currently being typed after `trigger`.
 *
 * The trigger must start a word (start of the value or preceded by whitespace)
 * and the token itself cannot contain whitespace, mirroring the `#\S+` hashtag
 * grammar used by `parseHashtags`. Returns `null` when no token is active.
 */
export const findActiveAutocompleteToken = (
  value: string,
  trigger: string,
): AutocompleteToken | null => {
  const start = value.lastIndexOf(trigger)
  if (start === -1) return null

  const before = start > 0 ? value[start - 1] : ''
  if (before && !/\s/.test(before)) return null

  const query = value.slice(start + trigger.length)
  if (/\s/.test(query)) return null

  return { start, end: value.length, query }
}

export interface UseAutocompleteOptions<T extends AutocompleteOption> {
  /** Controlled value of the input or textarea the hook is attached to. */
  inputValue: string
  /** Resolves the options for the text typed after the trigger. May be async. */
  getSuggestions: (query: string) => Promise<T[]> | T[]
  /** Called when the user picks an option (via click or keyboard). */
  onSelect: (option: T, nextInputValue: string) => void
  /** Character that opens the dropdown. Defaults to `#`. */
  trigger?: string
  /** Minimum characters typed after the trigger before loading options. Default 0. */
  minQueryLength?: number
  /** Debounce delay in milliseconds before loading options. Default 150. */
  debounceMs?: number
  /** Maximum number of options surfaced at once. Default 8. */
  maxSuggestions?: number
  /** Disables the dropdown when false. Default true. */
  enabled?: boolean
  /** Appends a trailing space after an inserted option. Default true. */
  appendSpace?: boolean
}

export interface UseAutocompleteResult<T extends AutocompleteOption> {
  /** Whether the dropdown should be visible. */
  isOpen: boolean
  /** Text typed after the trigger character. */
  query: string
  /** Options matching the current query. */
  suggestions: T[]
  /** Index of the highlighted option (already clamped to the options range). */
  highlightedIndex: number
  /** Index of the trigger character in `inputValue`, or -1 when inactive. */
  tokenStart: number
  /** Index just past the active token in `inputValue`, or -1 when inactive. */
  tokenEnd: number
  setHighlightedIndex: (index: number) => void
  /** Dismisses the dropdown until the value changes again. */
  close: () => void
  /** Selects an option programmatically (used by click handlers). */
  select: (option: T) => void
  /** Returns `inputValue` with the active token replaced by the option. */
  buildValue: (option: T) => string
  /**
   * Keyboard handler to call from the input's `onKeyDown`. Returns `true` when
   * the event was handled, so callers can skip their own key handling.
   */
  onKeyDown: (
    event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => boolean
}

// Stable empty list, so `suggestions` keeps its identity while there is no query
const noSuggestions: never[] = []

/**
 * Reusable autocomplete state machine for text inputs.
 *
 * It watches a controlled `inputValue` for a `trigger` character, loads
 * matching options (optionally async and debounced), and manages open/close
 * plus keyboard navigation. It is presentation agnostic: render the returned
 * `suggestions` however you like and call `onKeyDown` from the input.
 */
export const useAutocomplete = <T extends AutocompleteOption>({
  inputValue,
  getSuggestions,
  onSelect,
  trigger = '#',
  minQueryLength = 0,
  debounceMs = 150,
  maxSuggestions = 8,
  enabled = true,
  appendSpace = true,
}: UseAutocompleteOptions<T>): UseAutocompleteResult<T> => {
  const [fetchedSuggestions, setSuggestions] = useState<T[]>([])
  const [highlightedIndex, setHighlightedIndexState] = useState(0)
  // Value present when the user dismissed the dropdown, so it stays closed
  // until they type something new.
  const [dismissedFor, setDismissedFor] = useState<string | null>(null)

  // Keep the latest callbacks/props in refs so the fetch effect only depends on
  // the token itself and does not re-subscribe on every render.
  const getSuggestionsRef = useRef(getSuggestions)
  const onSelectRef = useRef(onSelect)
  const maxSuggestionsRef = useRef(maxSuggestions)

  useEffect(() => {
    getSuggestionsRef.current = getSuggestions
    onSelectRef.current = onSelect
    maxSuggestionsRef.current = maxSuggestions
  })

  const token = useMemo(
    () => (enabled ? findActiveAutocompleteToken(inputValue, trigger) : null),
    [enabled, inputValue, trigger],
  )
  const query = token?.query ?? ''
  const hasQuery = enabled && token !== null && query.length >= minQueryLength
  // Results for a previous token are hidden as soon as the token becomes invalid.
  const suggestions = hasQuery ? fetchedSuggestions : noSuggestions

  useEffect(() => {
    if (!enabled || !token || token.query.length < minQueryLength) {
      return
    }

    let cancelled = false
    const handle = setTimeout(() => {
      Promise.resolve(getSuggestionsRef.current(token.query))
        .then((result) => {
          if (cancelled) return
          setSuggestions((result ?? []).slice(0, maxSuggestionsRef.current))
          setHighlightedIndexState(0)
        })
        .catch(() => {
          if (!cancelled) setSuggestions([])
        })
    }, debounceMs)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
    // `token.query`/`token.start` are primitives, so this only re-runs when the
    // active token actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, token?.query, token?.start, minQueryLength, debounceMs])

  const canOpen = hasQuery && dismissedFor !== inputValue
  const isOpen = canOpen && suggestions.length > 0
  const safeHighlightedIndex =
    suggestions.length === 0
      ? 0
      : Math.min(highlightedIndex, suggestions.length - 1)

  const buildValue = (option: T): string => {
    const insert = option.insertText ?? option.label
    const suffix = appendSpace ? ' ' : ''
    if (!token) {
      return `${inputValue}${trigger}${insert}${suffix}`
    }
    const before = inputValue.slice(0, token.start)
    const after = inputValue.slice(token.end)
    return `${before}${trigger}${insert}${suffix}${after}`
  }

  const select = (option: T) => {
    if (!option) return
    const nextInputValue = buildValue(option)
    onSelectRef.current(option, nextInputValue)
    setSuggestions([])
    setDismissedFor(nextInputValue)
  }

  const close = () => {
    setSuggestions([])
    setDismissedFor(inputValue)
  }

  const onKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ): boolean => {
    if (!isOpen) return false

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setHighlightedIndexState((prev) => (prev + 1) % suggestions.length)
        return true
      case 'ArrowUp':
        event.preventDefault()
        setHighlightedIndexState(
          (prev) => (prev - 1 + suggestions.length) % suggestions.length,
        )
        return true
      case 'Enter':
        // Ctrl/Cmd+Enter is reserved for submitting, so let it through.
        if (event.ctrlKey || event.metaKey) return false
        event.preventDefault()
        select(suggestions[safeHighlightedIndex])
        return true
      case 'Tab':
        event.preventDefault()
        select(suggestions[safeHighlightedIndex])
        return true
      case 'Escape':
        event.preventDefault()
        close()
        return true
      default:
        return false
    }
  }

  return {
    isOpen,
    query,
    suggestions,
    highlightedIndex: safeHighlightedIndex,
    tokenStart: token?.start ?? -1,
    tokenEnd: token?.end ?? -1,
    setHighlightedIndex: setHighlightedIndexState,
    close,
    select,
    buildValue,
    onKeyDown,
  }
}
