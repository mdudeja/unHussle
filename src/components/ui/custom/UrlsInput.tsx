import React, { useState } from 'react'
import { Link, Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { normalizeUrl } from '@/lib/inputParsers/parseUrl'
import type { UrlInput } from '@c/types/index'

export interface UrlsInputProps {
  id?: string
  value?: UrlInput[] | null
  onChange: (value: UrlInput[]) => void
  disabled?: boolean
  placeholder?: string
  hasError?: boolean
}

// Returns the normalized URL, or undefined when it is not an absolute URL.
const toValidUrl = (raw: string): string | undefined => {
  const url = normalizeUrl(raw.trim())
  try {
    new URL(url)
    return url
  } catch {
    return undefined
  }
}

/** Input that collects a list of links as removable chips. */
export function UrlsInput({
  id,
  value,
  onChange,
  disabled,
  placeholder = 'https://...',
  hasError,
}: UrlsInputProps) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | undefined>(undefined)

  const selected = value ?? []

  const commit = () => {
    if (!draft.trim()) return
    const url = toValidUrl(draft)
    if (!url) {
      setError('Enter a valid link, e.g. https://example.com')
      return
    }
    setDraft('')
    setError(undefined)
    if (selected.some((item) => item.url === url)) return
    onChange([...selected, { url }])
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      // Keep Enter from submitting the surrounding form.
      event.preventDefault()
      commit()
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          id={id}
          type="url"
          value={draft}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={hasError || Boolean(error)}
          onChange={(event) => {
            setDraft(event.target.value)
            setError(undefined)
          }}
          onKeyDown={handleKeyDown}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled || !draft.trim()}
          onClick={commit}
          title="Add link"
        >
          <Plus className="size-4" />
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((item) => (
            <Badge
              key={item.url}
              variant="link_border"
              className="max-w-full gap-1 pr-1"
              title={item.url}
            >
              <Link className="size-3" />
              <span className="truncate">{item.title || item.url}</span>
              {!disabled && (
                <button
                  type="button"
                  aria-label={`Remove link ${item.url}`}
                  onClick={() =>
                    onChange(selected.filter((other) => other.url !== item.url))
                  }
                  className="rounded-full hover:bg-primary/20"
                >
                  <X className="size-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
