import React, { useState, useRef, useEffect } from 'react'
import { useStore } from '@/store'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatDdMmYyyy,
  formatMillisAsDdMmYyyy,
  getStartOfDayMillis,
} from '@c/datetimeUtils'
import {
  parseDataFromTaskInput,
  ParsedData,
} from '@/lib/inputParsers/parseDataFromTaskInput'

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
}

const emptyFlags: TaskFlags = {
  is_fun: false,
  is_chore: false,
  is_quick: false,
}

const flagOptions = [
  { key: 'is_fun', label: 'Fun', icon: Smile },
  { key: 'is_chore', label: 'Chore', icon: ClipboardList },
  { key: 'is_quick', label: 'Quick', icon: Zap },
] as const

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

  const tasks = useStore((state) => state.tasks)
  const areas = useStore((state) => state.areas)
  const projects = useStore((state) => state.projects)
  const goals = useStore((state) => state.goals)

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

  const resetForm = () => {
    setInputValue('')
    setIsExpanded(false)
    setParsedData(starterParsedData)
    setPriority(Priority.MEDIUM)
    setFlags(emptyFlags)
    setDueDate(undefined)
  }

  const toggleFlag = (key: keyof TaskFlags) => {
    setFlags((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSelectDueDate = (date?: Date) => {
    setDueDate(date)
    setIsCalendarOpen(false)
  }

  const handleSubmit = async () => {
    if (!parsedData.task.title.trim() && inputValue.trim()) {
      // If all text was parsed out, use original
      parsedData.task.title = inputValue.trim()
    }

    if (!parsedData.task.title.trim()) {
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
        estimated_minutes: parsedData.task.estimated_minutes,
        due_date: effectiveDueMillis,
      })

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
              placeholder="Quick brain dump... (Ctrl+Enter to save, Esc to cancel)"
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
              placeholder="Write your extended thoughts here... Use # for tags/projects/areas/goals. Add 'high priority', 'fun', 'quick', etc. Include URLs. Add time estimates like '30m' or '2h'. Add due dates like 'tomorrow' or '4th January'."
              rows={8}
              disabled={isSubmitting}
            />
          </div>
        )}
      </div>

      {/* Task metadata controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Priority selector */}
        <div className="flex items-center gap-1.5">
          <Flag className="h-4 w-4 text-muted-foreground" />
          <div className="flex overflow-hidden rounded-md border border-border">
            {(Object.values(Priority) as Priority[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                disabled={isSubmitting}
                className={cn(
                  'px-2.5 py-1 text-xs capitalize transition-colors',
                  priority === p
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Fun / Chore / Quick toggles */}
        {flagOptions.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => toggleFlag(key)}
            disabled={isSubmitting}
            aria-pressed={flags[key]}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
              flags[key]
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}

        {/* Due date selector */}
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              className={cn(
                'gap-1.5 font-normal',
                !selectedDate && 'text-muted-foreground',
              )}
            >
              <CalendarIcon className="h-4 w-4" />
              {selectedDate ? formatDdMmYyyy(selectedDate) : 'Due date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
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
      </div>

      {/* Parsed data visualization */}
      {inputValue && (
        <div className="flex flex-wrap gap-2 text-sm">
          {parsedData.task.title && (
            <Badge variant="outline" className="text-xs">
              Task: {parsedData.task.title.substring(0, 30)}
              {parsedData.task.title.length > 30 ? '...' : ''}
            </Badge>
          )}
          {priority !== Priority.MEDIUM && (
            <Badge
              variant={priority === Priority.HIGH ? 'destructive' : 'secondary'}
              className="text-xs"
            >
              {priority}
            </Badge>
          )}
          {parsedData.task.project_id && (
            <Badge variant="default" className="text-xs">
              Project: {parsedData.task.project_id}
            </Badge>
          )}
          {parsedData.task.area_id && (
            <Badge variant="default" className="text-xs">
              Area: {parsedData.task.area_id}
            </Badge>
          )}
          {parsedData.task.goal_id && (
            <Badge variant="default" className="text-xs">
              Goal: {parsedData.task.goal_id}
            </Badge>
          )}
          {parsedData.tags.map((tag, idx) => (
            <Badge key={idx} variant="outline" className="text-xs">
              #{tag.title}
            </Badge>
          ))}
          {flags.is_fun && (
            <Badge variant="secondary" className="text-xs border-border">
              <Smile className="h-5 w-5" />
              Fun
            </Badge>
          )}
          {flags.is_chore && (
            <Badge variant="secondary" className="text-xs border-border">
              <ClipboardList className="h-5 w-5" />
              Chore
            </Badge>
          )}
          {flags.is_quick && (
            <Badge variant="secondary" className="text-xs border-border">
              <Zap className="h-5 w-5" />
              Quick
            </Badge>
          )}
          {parsedData.task.estimated_minutes && (
            <Badge variant="outline" className="text-xs">
              Est: {parsedData.task.estimated_minutes}m
            </Badge>
          )}
          {effectiveDueMillis !== undefined && (
            <Badge variant="outline" className="text-xs">
              Due: {formatMillisAsDdMmYyyy(effectiveDueMillis)}
            </Badge>
          )}
          {parsedData.urls.map((url, idx) => (
            <Badge key={idx} variant="outline" className="text-xs">
              Link: {url.url.substring(0, 20)}...
            </Badge>
          ))}
        </div>
      )}

      {/* Submit button */}
      {inputValue && (
        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !parsedData.task.title.trim()}
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
        Use # for tags/projects/areas/goals • Add priority (high/low) • Mark as
        fun/chore/quick • Add time (est:|et: 30m, 2h) • Set due date (today,
        tomorrow, next Friday) or pick due date from a date picker
      </p>
    </div>
  )
}
