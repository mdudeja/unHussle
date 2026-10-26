import React, { useState, useRef, useEffect } from 'react'
import { useStore } from '@/store'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Priority, ProgressStatus } from '@c/types/index'
import {
  Expand,
  Minimize2,
  Loader2,
  Smile,
  ClipboardList,
  Zap,
  Flag,
  CalendarIcon,
  ListTodo,
  Crosshair,
  Clock9,
  Repeat,
  CalendarClock,
} from 'lucide-react'
import { RecurranceRule, Tag } from '@d/database/schemas'
import { RecurranceRuleInput } from '@/components/ui/custom/RecurranceRuleInput'
import { cn } from '@/lib/utils'
import {
  formatDdMmYyyy,
  formatMillisAsDdMmYyyy,
  formatMillisAsDdMmYyyyHhMm,
  getStartOfDayMillis,
} from '@c/datetimeUtils'
import { resolveTaskSchedule, validateTaskSchedule } from '@c/taskSchedule'
import {
  parseDataFromTaskInput,
  ParsedData,
} from '@/lib/inputParsers/parseDataFromTaskInput'
import { useAPGHashtagAutocomplete } from '@/lib/hooks/useAPGHashtagAutocomplete'
import { AutocompleteList } from '@/components/ui/custom/AutocompleteList'
import IconBadge from '@/components/ui/custom/IconBadge'
import IconButton from '@/components/ui/custom/IconButton'
import PriorityView from '@/components/ui/custom/PriorityView'
import EntityRefBadge from '@/components/ui/custom/EntityRefBadge'
import { trimString } from '@/components/ui/utils/misc'
import TagsView from '@/components/ui/custom/TagsView'
import { DateTimePicker } from '@/components/ui/custom/DateTimePicker'
import UrlView from '../ui/custom/UrlView'

const starterParsedData: ParsedData = {
  task: {
    title: '',
    priority: Priority.MEDIUM,
  },
  urls: [],
  tags: [],
}

type TaskFlags = {
  is_fun: boolean
  is_chore: boolean
  is_quick: boolean
  is_recurring: boolean
}

const emptyFlags: TaskFlags = {
  is_fun: false,
  is_chore: false,
  is_quick: false,
  is_recurring: false,
}

const flagOptions = [
  { key: 'is_fun', label: 'Fun', icon: Smile },
  { key: 'is_chore', label: 'Chore', icon: ClipboardList },
  { key: 'is_quick', label: 'Quick', icon: Zap },
  { key: 'is_recurring', label: 'Recurring', icon: Repeat },
] as const

const defaultRecurranceRule: RecurranceRule = { type: 'daily', data: {} }

// Formats a JS Date (local time) as DD/MM/YYYY.
export const BrainDumpInputComponent = () => {
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [inputValue, setInputValue] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [parsedData, setParsedData] = useState<ParsedData>(starterParsedData)
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM)
  const [flags, setFlags] = useState<TaskFlags>(emptyFlags)
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [recurranceRule, setRecurranceRule] = useState<RecurranceRule>(
    defaultRecurranceRule,
  )
  const [scheduledStart, setScheduledStart] = useState<number | undefined>()
  const [scheduledEnd, setScheduledEnd] = useState<number | undefined>()

  const tasks = useStore((state) => state.tasks)
  const areas = useStore((state) => state.areas)
  const projects = useStore((state) => state.projects)
  const goals = useStore((state) => state.goals)
  const tags = useStore((state) => state.tags)
  const urls = useStore((state) => state.urls)

  // `#` autocomplete for areas, projects, goals and tags. Selecting a suggestion
  // inserts its hashtag (e.g. `#health_fitness`) at the cursor token.
  const autocomplete = useAPGHashtagAutocomplete({
    inputValue,
    enabled: !isSubmitting,
    onSelect: (_suggestion, nextInputValue) => {
      setInputValue(nextInputValue)
    },
  })

  // Plain tags are offered in the `#` dropdown alongside areas/projects/goals.
  useEffect(() => {
    if (tags.data.length === 0) tags.fetch().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const parsed = parseDataFromTaskInput({
      input: inputValue,
      projects: projects.data,
      areas: areas.data,
      goals: goals.data,
    })
    setParsedData(parsed)
  }, [inputValue])

  const parsedDueMillis = parsedData.task.due_date ?? undefined
  const parsedDueDate =
    parsedDueMillis !== undefined ? new Date(parsedDueMillis) : undefined
  // A date chosen from the picker takes precedence over one typed in the input.
  const selectedDate = dueDate ?? parsedDueDate
  const effectiveDueMillis =
    dueDate !== undefined
      ? getStartOfDayMillis({
          year: dueDate.getFullYear(),
          month: dueDate.getMonth() + 1,
          day: dueDate.getDate(),
        })
      : parsedDueMillis

  // Start or end + the parsed estimate is enough; the missing part is derived.
  const schedule = resolveTaskSchedule({
    scheduled_start: scheduledStart,
    scheduled_end: scheduledEnd,
    estimated_minutes: parsedData.task.estimated_minutes,
  })
  const scheduleError = validateTaskSchedule(schedule)

  const resetForm = () => {
    setInputValue('')
    setIsExpanded(false)
    setParsedData(starterParsedData)
    setPriority(Priority.MEDIUM)
    setFlags(emptyFlags)
    setDueDate(undefined)
    setRecurranceRule(defaultRecurranceRule)
    setScheduledStart(undefined)
    setScheduledEnd(undefined)
  }

  const toggleFlag = (key: keyof TaskFlags) => {
    setFlags((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSelectDueDate = (date?: Date) => {
    setDueDate(date)
    setIsCalendarOpen(false)
  }

  const handleSubmit = async () => {
    // the user may have pasted a URL and nothing else, in which case we just add the URL(s) to the store and don't create a task.
    if (!parsedData.task.title.trim() && parsedData.urls.length) {
      setIsSubmitting(true)
      await Promise.all(
        parsedData.urls.map((url) => urls.add({ url: url.url })),
      )
      await urls.fetch().catch(() => {})
      setIsSubmitting(false)
      resetForm()
      return
    }

    if (!parsedData.task.title.trim() && inputValue.trim()) {
      // If all text was parsed out, use original
      parsedData.task.title = inputValue.trim()
    }

    if (!parsedData.task.title.trim() || scheduleError) {
      return
    }

    setIsSubmitting(true)

    try {
      if (
        !parsedData.task.project_id &&
        !parsedData.task.area_id &&
        !parsedData.task.goal_id
      ) {
        const brainDumpArea = areas.data.find(
          (a) => a.title.toLowerCase() === 'brain dump',
        )

        if (!brainDumpArea) {
          throw new Error('Brain Dump area not found')
        }
        parsedData.task.area_id = brainDumpArea.id
      }

      // Create task
      await tasks.add({
        title: parsedData.task.title,
        description: isExpanded ? inputValue : undefined,
        status: ProgressStatus.PLANNED,
        priority,
        project_id: parsedData.task.project_id,
        area_id: parsedData.task.area_id,
        goal_id: parsedData.task.goal_id,
        is_fun: flags.is_fun,
        is_chore: flags.is_chore,
        is_quick: flags.is_quick,
        is_recurring: flags.is_recurring,
        recurrance_rule: flags.is_recurring ? recurranceRule : undefined,
        estimated_minutes: schedule.estimated_minutes,
        due_date: effectiveDueMillis,
        scheduled_start: schedule.scheduled_start,
        scheduled_end: schedule.scheduled_end,
        tags: parsedData.tags,
        urls: parsedData.urls,
      })

      // Newly created tags and urls should show up in the tag list and pickers
      if (parsedData.tags.length > 0) tags.fetch().catch(() => {})
      if (parsedData.urls.length > 0) urls.fetch().catch(() => {})

      // Reset form
      resetForm()
    } catch (error) {
      console.error('Failed to create task:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    // Let the autocomplete consume navigation and selection keys when open.
    if (autocomplete.onKeyDown(e)) {
      return
    }

    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      resetForm()
    }
  }

  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  const selectedProject = projects.getById(parsedData.task.project_id)
  const selectedArea = areas.getById(parsedData.task.area_id)
  const selectedGoal = goals.getById(parsedData.task.goal_id)

  return (
    <div className="w-full space-y-2">
      <div className="relative">
        {!isExpanded ? (
          <div className="flex gap-2 items-center">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Quick brain dump... #tags, links (Ctrl+Enter to save, Esc to cancel)"
              className="flex-1"
              disabled={isSubmitting}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleExpand}
              disabled={isSubmitting}
              title="Expand for detailed notes"
            >
              <Expand className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium">Extended Notes</label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggleExpand}
                disabled={isSubmitting}
                title="Minimize"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write your extended thoughts here... Use # for tags/projects/areas/goals. Add 'high priority', 'fun', 'quick', etc. Include links (https://... or www....) to attach them. Add time estimates like '30m' or '2h'. Add due dates like 'tomorrow' or '4th January'."
              rows={8}
              disabled={isSubmitting}
            />
          </div>
        )}

        {autocomplete.isOpen && (
          <AutocompleteList
            options={autocomplete.suggestions}
            highlightedIndex={autocomplete.highlightedIndex}
            onSelect={autocomplete.select}
            onHighlight={autocomplete.setHighlightedIndex}
            className="absolute left-0 right-0 top-full z-50 mt-1"
          />
        )}
      </div>

      {/* Task metadata controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Priority selector */}
        <div className="flex items-center gap-1.5">
          <Flag className="h-5 w-5 text-muted-foreground" />
          <div className="flex overflow-hidden rounded-md border border-border">
            {(Object.values(Priority) as Priority[]).map((p) => (
              <Button
                key={p}
                type="button"
                variant={priority === p ? 'default' : 'outline'}
                size="sm"
                disabled={isSubmitting}
                className="rounded-none"
                onClick={() => setPriority(p)}
              >
                {p}
              </Button>
            ))}
          </div>
        </div>

        {/* Fun / Chore / Quick toggles */}
        {flagOptions.map(({ key, label, icon: Icon }) => (
          <IconButton
            key={key}
            type="button"
            onClick={() => toggleFlag(key)}
            disabled={isSubmitting}
            variant={flags[key] ? 'default' : 'outline'}
            icon={<Icon className="h-3.5 w-3.5" />}
            className="rounded-full"
          >
            {label}
          </IconButton>
        ))}

        {/* Due date selector */}
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSubmitting}
                className={cn(
                  'gap-1.5',
                  !selectedDate && 'text-muted-foreground',
                )}
              />
            }
          >
            <CalendarIcon className="h-4 w-4" />
            {selectedDate ? formatDdMmYyyy(selectedDate) : 'Due date'}
          </PopoverTrigger>
          <PopoverContent align="start" side="bottom" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleSelectDueDate}
              autoFocus
            />
            {selectedDate && (
              <div className="border-t p-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => handleSelectDueDate(undefined)}
                >
                  Clear due date
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Scheduled start / end */}
        <DateTimePicker
          size="sm"
          value={scheduledStart}
          onChange={setScheduledStart}
          disabled={isSubmitting}
          placeholder="Start"
          hasError={Boolean(scheduleError)}
        />
        <DateTimePicker
          size="sm"
          value={scheduledEnd}
          onChange={setScheduledEnd}
          disabled={isSubmitting}
          placeholder="End"
          hasError={Boolean(scheduleError)}
        />
      </div>

      {scheduleError && (
        <p className="text-xs text-destructive">{scheduleError}</p>
      )}

      {/* Recurrance rule editor */}
      {flags.is_recurring && (
        <RecurranceRuleInput
          className="rounded-md border border-border p-3"
          value={recurranceRule}
          onChange={setRecurranceRule}
        />
      )}

      {/* Parsed data visualization */}
      {inputValue && (
        <div className="flex flex-wrap gap-2 text-sm">
          {priority !== Priority.MEDIUM && <PriorityView priority={priority} />}
          {parsedData.task.title && (
            <IconBadge
              variant="outline"
              className="text-xs"
              icon={<ListTodo className="h-4 w-4" />}
            >
              {trimString(parsedData.task.title, 30)}
            </IconBadge>
          )}
          <div className="basis-full h-0" />
          {selectedProject && (
            <EntityRefBadge kind="projects" id={selectedProject.id} />
          )}
          {selectedArea && <EntityRefBadge kind="areas" id={selectedArea.id} />}
          {selectedGoal && <EntityRefBadge kind="goals" id={selectedGoal.id} />}
          <div className="basis-full h-0" />
          {schedule.estimated_minutes && (
            <IconBadge
              variant="muted"
              className="text-xs"
              icon={<Clock9 className="h-4 w-4" />}
            >
              {schedule.estimated_minutes}m
            </IconBadge>
          )}
          {(schedule.scheduled_start !== undefined ||
            schedule.scheduled_end !== undefined) && (
            <IconBadge
              variant="muted"
              className="text-xs"
              icon={<CalendarClock className="h-4 w-4" />}
            >
              {schedule.scheduled_start
                ? formatMillisAsDdMmYyyyHhMm(schedule.scheduled_start)
                : '?'}
              {' → '}
              {schedule.scheduled_end
                ? formatMillisAsDdMmYyyyHhMm(schedule.scheduled_end)
                : '?'}
            </IconBadge>
          )}
          {effectiveDueMillis !== undefined && (
            <IconBadge
              variant="muted"
              className="text-xs"
              icon={<Crosshair className="h-4 w-4" />}
            >
              {formatMillisAsDdMmYyyy(effectiveDueMillis)}
            </IconBadge>
          )}
          <div className="basis-full h-0" />
          {parsedData.tags && (
            <TagsView tags={parsedData.tags as Tag['Read'][]} />
          )}
          <div className="basis-full h-0" />
          {parsedData.urls.map((url, idx) => (
            <UrlView key={`${idx}`} url={url.url} />
          ))}
        </div>
      )}

      {/* Submit button */}
      {inputValue && (
        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              Boolean(scheduleError) ||
              (!parsedData.task.title.trim() && !parsedData.urls.length)
            }
            className="flex-1"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Add Task (Ctrl+Enter)'
            )}
          </Button>
          <Button variant="outline" onClick={resetForm} disabled={isSubmitting}>
            Cancel
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Use # for tags/projects/areas/goals • Paste links to attach them • Add
        priority (high/low) • Mark as fun/chore/quick • Add time (est:|et: 30m,
        2h) • Set due date (today, tomorrow, next Friday) or pick due date from
        a date picker • Schedule a start or end (with an estimate, the other is
        calculated)
      </p>
    </div>
  )
}
