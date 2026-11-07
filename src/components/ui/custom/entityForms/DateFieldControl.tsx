import { useState } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { CalendarIcon } from 'lucide-react'
import { dateToStartOfDayMillis, formatDdMmYyyy } from '@c/datetimeUtils'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface DateFieldControlProps {
  fieldId: string
  value: unknown
  disabled?: boolean
  placeholder?: string
  hasError?: boolean
  onChange: (value: unknown) => void
}

export function DateFieldControl({
  fieldId,
  value,
  disabled,
  placeholder,
  hasError,
  onChange,
}: DateFieldControlProps) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedDate = typeof value === 'number' ? new Date(value) : undefined

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        render={
          <Button
            id={fieldId}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-invalid={hasError}
            className={cn(
              'w-full justify-start gap-2 font-normal',
              !selectedDate && 'text-muted-foreground',
            )}
          />
        }
      >
        <CalendarIcon className="size-4" />
        {selectedDate
          ? formatDdMmYyyy(selectedDate)
          : (placeholder ?? 'Pick a date')}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selectedDate}
          autoFocus
          onSelect={(date) => {
            onChange(date ? dateToStartOfDayMillis(date) : undefined)
            setIsOpen(false)
          }}
        />
        {selectedDate && (
          <div className="border-t p-2">
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
              Clear date
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
