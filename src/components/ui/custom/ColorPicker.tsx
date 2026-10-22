import { useState } from 'react'
import { HexColorPicker } from 'react-colorful'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export const PRESET_COLORS = [
  '#64748b',
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
]

const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

export interface ColorPickerProps {
  id?: string
  value?: string | null
  onChange: (value: string | undefined) => void
  disabled?: boolean
  placeholder?: string
  hasError?: boolean
}

/**
 * Popover based color picker. Emits a hex string (e.g. `#3b82f6`), or
 * `undefined` when cleared.
 */
export function ColorPicker({
  id,
  value,
  onChange,
  disabled,
  placeholder,
  hasError,
}: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const color = value || undefined

  const handleOpenChange = (open: boolean) => {
    if (open) setDraft(value ?? '')
    setIsOpen(open)
  }

  const commit = (next: string) => {
    setDraft(next)
    onChange(next)
  }

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={hasError}
          className={cn(
            'w-full justify-start gap-2 font-normal',
            !color && 'text-muted-foreground',
          )}
        >
          <span
            className="size-4 shrink-0 rounded-sm border"
            style={{ backgroundColor: color }}
          />
          {color ?? placeholder ?? 'Pick a color'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto space-y-3 p-3">
        <div className="grid grid-cols-5 gap-2">
          {PRESET_COLORS.map((preset) => (
            <button
              key={preset}
              type="button"
              title={preset}
              aria-label={preset}
              onClick={() => commit(preset)}
              className={cn(
                'size-7 rounded-md border transition-transform hover:scale-110 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                color?.toLowerCase() === preset &&
                  'ring-2 ring-ring ring-offset-2 ring-offset-background',
              )}
              style={{ backgroundColor: preset }}
            />
          ))}
        </div>
        <HexColorPicker
          color={color ?? PRESET_COLORS[0]}
          onChange={commit}
          className="!w-full"
        />
        <Input
          value={draft}
          placeholder="#aabbcc"
          aria-label="Hex color"
          className="font-mono"
          onChange={(event) => {
            let next = event.target.value.trim()
            if (next && !next.startsWith('#')) next = `#${next}`
            setDraft(next)
            if (HEX_PATTERN.test(next)) onChange(next.toLowerCase())
          }}
        />
        {color && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => {
              onChange(undefined)
              setIsOpen(false)
            }}
          >
            Clear color
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}
