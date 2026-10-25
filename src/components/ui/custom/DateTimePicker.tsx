import { useState } from 'react'
import { CalendarClock, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  dateAndTimeToMillis,
  formatHhMm,
  formatMillisAsDdMmYyyyHhMm,
} from '@c/datetimeUtils'

// Time used when a day is picked before a time has been set.
const DEFAULT_TIME = '09:00'

interface DateTimePickerProps {
  id?: string
  /** Epoch millis. */
  value?: number | null
  onChange: (value: number | undefined) => void
  disabled?: boolean
  placeholder?: string
  hasError?: boolean
  size?: 'default' | 'sm'
  className?: string
}

/**
 * Picks a day and a time of day. The popover stays open after picking a day so
 * the time can be adjusted right away.
 */
export function DateTimePicker({
  id,
  value,
  onChange,
  disabled,
  placeholder = 'Pick a date & time',
  hasError,
  size = 'default',
  className,
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedDate = typeof value === 'number' ? new Date(value) : undefined
  const time = selectedDate ? formatHhMm(selectedDate) : DEFAULT_TIME

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            size={size}
            disabled={disabled}
            aria-invalid={hasError}
            className={cn(
              'justify-start gap-2 font-normal',
              !selectedDate && 'text-muted-foreground',
              className,
            )}
          />
        }
      >
        <CalendarClock className="size-4" />
        {typeof value === 'number'
          ? formatMillisAsDdMmYyyyHhMm(value)
          : placeholder}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selectedDate}
          autoFocus
          onSelect={(date) =>
            onChange(date ? dateAndTimeToMillis(date, time) : undefined)
          }
        />
        <div className="flex items-center gap-2 border-t p-2">
          <Clock className="size-4 text-muted-foreground" />
          <Input
            type="time"
            value={time}
            onChange={(event) => {
              if (!event.target.value) return
              onChange(
                dateAndTimeToMillis(
                  selectedDate ?? new Date(),
                  event.target.value,
                ),
              )
            }}
          />
        </div>
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
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
