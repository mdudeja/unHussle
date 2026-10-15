import React, { useState, useRef, useEffect } from 'react'
import { Temporal } from 'temporal-polyfill'
import { useStore } from '@/store'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Priority, ProgressStatus, Task } from '@c/types/index'
import { Expand, Minimize2, Loader2 } from 'lucide-react'
import { Tag, Url } from '@d/database/schemas'
import { parseDataFromTaskInput } from '@/lib/inputParsers/parseDataFromTaskInput'

interface ParsedData {
  task: Task['Write']
  urls: Url['Write'][]
  tags: Tag['Write'][]
}

const starterParsedData: ParsedData = {
  task: {
    title: '',
    priority: Priority.MEDIUM,
    is_fun: false,
    is_chore: false,
    is_quick: false,
  },
  urls: [],
  tags: [],
}

export const BrainDumpInputComponent = () => {
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [inputValue, setInputValue] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [parsedData, setParsedData] = useState<ParsedData>(starterParsedData)

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
        priority: parsedData.task.priority,
        project_id: parsedData.task.project_id,
        area_id: parsedData.task.area_id,
        goal_id: parsedData.task.goal_id,
        is_fun: parsedData.task.is_fun,
        is_chore: parsedData.task.is_chore,
        is_quick: parsedData.task.is_quick,
        estimated_minutes: parsedData.task.estimated_minutes,
        due_date: parsedData.task.due_date,
      })

      // Reset form
      setInputValue('')
      setIsExpanded(false)
      setParsedData(starterParsedData)
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
      setInputValue('')
      setIsExpanded(false)
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

      {/* Parsed data visualization */}
      {inputValue && (
        <div className="flex flex-wrap gap-2 text-sm">
          {parsedData.task.title && (
            <Badge variant="outline" className="text-xs">
              Task: {parsedData.task.title.substring(0, 30)}
              {parsedData.task.title.length > 30 ? '...' : ''}
            </Badge>
          )}
          {parsedData.task.priority !== Priority.MEDIUM && (
            <Badge
              variant={
                parsedData.task.priority === Priority.HIGH
                  ? 'destructive'
                  : 'secondary'
              }
              className="text-xs"
            >
              {parsedData.task.priority}
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
          {parsedData.task.is_fun && (
            <Badge variant="secondary" className="text-xs">
              Fun
            </Badge>
          )}
          {parsedData.task.is_chore && (
            <Badge variant="secondary" className="text-xs">
              Chore
            </Badge>
          )}
          {parsedData.task.is_quick && (
            <Badge variant="secondary" className="text-xs">
              Quick
            </Badge>
          )}
          {parsedData.task.estimated_minutes && (
            <Badge variant="outline" className="text-xs">
              Est: {parsedData.task.estimated_minutes}m
            </Badge>
          )}
          {parsedData.task.due_date && (
            <Badge variant="outline" className="text-xs">
              Due:{' '}
              {Temporal.Instant.fromEpochMilliseconds(parsedData.task.due_date)
                .toZonedDateTimeISO(Temporal.Now.timeZoneId())
                .toPlainDate()
                .toString()}
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
          <Button
            variant="outline"
            onClick={() => {
              setInputValue('')
              setIsExpanded(false)
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Use # for tags/projects/areas/goals • Add priority (high/low) • Mark as
        fun/chore/quick • Add time (30m, 2h) • Set due date (today, tomorrow,
        next Friday)
      </p>
    </div>
  )
}
