import { useId } from 'react'
import { Plus, X } from 'lucide-react'
import { RecurranceRule, RecurranceType } from '@d/database/schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import {
  getSortedMonthNames,
  getSortedWeekdayNames,
  months,
  weekdays,
} from '@c/calendarUtils'

type Slot = { from: number; to: number }

const RECURRANCE_TYPES: { value: RecurranceType; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

// Stored values follow calendarUtils numbering: Monday = 1 … Sunday = 7,
// January = 1 … December = 12
const WEEK_DAYS = getSortedWeekdayNames().map((name) => ({
  name,
  value: weekdays[name].dayOfWeek,
}))
const MONTHS = getSortedMonthNames().map((name) => ({
  name,
  value: months[name].monthInt,
}))
const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

const DEFAULT_SLOT: Slot = { from: 9 * 60, to: 10 * 60 }

// Slots are stored as minutes from midnight
const minutesToTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

const timeToMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

const toNumbers = (values: string[]) => values.map(Number).sort((a, b) => a - b)

/**
 * Builds a rule of the given type, carrying over any fields from the
 * previous rule that the new type also supports.
 */
const buildRule = (
  type: RecurranceType,
  prev?: RecurranceRule | null,
): RecurranceRule => {
  const prevData: Partial<{
    anchorTaskIds: string[]
    slots: Slot[]
    weekDays: number[]
    monthDays: number[]
    months: number[]
  }> = prev?.data ?? {}
  const base = {
    anchorTaskIds: prevData.anchorTaskIds,
    slots: prevData.slots,
  }
  switch (type) {
    case 'daily':
      return { type, data: base }
    case 'weekly':
      return { type, data: { ...base, weekDays: prevData.weekDays ?? [] } }
    case 'monthly':
      return {
        type,
        data: {
          ...base,
          weekDays: prevData.weekDays ?? [],
          monthDays: prevData.monthDays ?? [],
        },
      }
    case 'yearly':
      return {
        type,
        data: {
          ...base,
          weekDays: prevData.weekDays ?? [],
          monthDays: prevData.monthDays ?? [],
          months: prevData.months ?? [],
        },
      }
  }
}

interface RecurranceRuleInputProps {
  value?: RecurranceRule | null
  onChange: (rule: RecurranceRule) => void
  className?: string
}

export function RecurranceRuleInput({
  value,
  onChange,
  className,
}: RecurranceRuleInputProps) {
  const id = useId()
  const rule = value ?? buildRule('daily')
  const slots = rule.data.slots ?? []

  const updateData = (data: Partial<Record<string, unknown>>) =>
    onChange({ ...rule, data: { ...rule.data, ...data } } as RecurranceRule)

  const updateSlot = (index: number, slot: Partial<Slot>) =>
    updateData({
      slots: slots.map((s, i) => (i === index ? { ...s, ...slot } : s)),
    })

  return (
    <div className={cn('space-y-2', className)}>
      {/* Frequency */}
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-type`} className="text-sm text-muted-foreground">
          Repeats
        </Label>
        <Select
          value={rule.type}
          onValueChange={(type) =>
            onChange(buildRule(type as RecurranceType, rule))
          }
        >
          <SelectTrigger id={`${id}-type`} className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RECURRANCE_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Months */}
      {rule.type === 'yearly' && (
        <div className="space-y-1.5">
          <Label className="text-sm text-muted-foreground">
            <span id={`${id}-months`}>Months</span>
          </Label>
          <ToggleGroup
            multiple={true}
            variant="outline"
            size="sm"
            className="grid w-full grid-cols-6"
            aria-labelledby={`${id}-months`}
            value={rule.data.months.map(String)}
            onValueChange={(v) => updateData({ months: toNumbers(v) })}
          >
            {MONTHS.map((m) => (
              <ToggleGroupItem
                key={m.name}
                value={String(m.value)}
                aria-label={m.name}
              >
                {m.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}

      {/* Days of month */}
      {(rule.type === 'monthly' || rule.type === 'yearly') && (
        <div className="space-y-1.5">
          <Label className="text-sm text-muted-foreground">
            <span id={`${id}-monthDays`}>Days of month</span>
          </Label>
          <ToggleGroup
            multiple={true}
            variant="outline"
            size="sm"
            className="grid w-full grid-cols-7"
            aria-labelledby={`${id}-monthDays`}
            value={rule.data.monthDays.map(String)}
            onValueChange={(v) => updateData({ monthDays: toNumbers(v) })}
          >
            {MONTH_DAYS.map((d) => (
              <ToggleGroupItem
                key={d}
                value={String(d)}
                aria-label={`Day ${d}`}
              >
                {d}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}

      {/* Days of week */}
      {rule.type !== 'daily' && (
        <div className="space-y-1.5">
          <Label className="text-sm text-muted-foreground">
            <span id={`${id}-weekDays`}>Days of week</span>
          </Label>
          <ToggleGroup
            multiple={true}
            variant="outline"
            size="sm"
            className="grid w-full grid-cols-7"
            aria-labelledby={`${id}-weekDays`}
            value={rule.data.weekDays.map(String)}
            onValueChange={(v) => updateData({ weekDays: toNumbers(v) })}
          >
            {WEEK_DAYS.map((d) => (
              <ToggleGroupItem
                key={d.name}
                value={String(d.value)}
                aria-label={d.name}
              >
                {d.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}

      {/* Time slots */}
      <div role="group" aria-labelledby={`${id}-slots`} className="space-y-1.5">
        <Label className="text-sm text-muted-foreground">
          <span id={`${id}-slots`}>Time slots</span>
        </Label>
        {slots.map((slot, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              type="time"
              className="w-32"
              aria-label={`Slot ${i + 1} start`}
              value={minutesToTime(slot.from)}
              onChange={(e) =>
                updateSlot(i, { from: timeToMinutes(e.target.value) })
              }
            />
            <span className="text-sm text-muted-foreground">to</span>
            <Input
              type="time"
              className="w-32"
              aria-label={`Slot ${i + 1} end`}
              value={minutesToTime(slot.to)}
              onChange={(e) =>
                updateSlot(i, { to: timeToMinutes(e.target.value) })
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove slot"
              onClick={() =>
                updateData({ slots: slots.filter((_, j) => j !== i) })
              }
            >
              <X size={14} />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => updateData({ slots: [...slots, DEFAULT_SLOT] })}
        >
          <Plus size={14} />
          Add slot
        </Button>
      </div>
    </div>
  )
}
