import React, { useState, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AlertCircle, MinusCircle, ArrowRight } from 'lucide-react'
import { useStore } from '@/store'
import { Priority, ProgressStatus } from '@c/types/index'
import { createId } from '@paralleldrive/cuid2'

export const BrainDumpInputComponent = ({
  ref,
}: React.ComponentProps<'div'>) => {
  const [inputValue, setInputValue] = useState('')
  const [selectedPriority, setSelectedPriority] = useState<Priority>(
    Priority.MEDIUM,
  )
  const inputRef = useRef<HTMLInputElement>(null)

  const { tasks, entity_tags } = useStore()

  const parseAndSubmit = async () => {
    if (!inputValue.trim()) return

    const rawText = inputValue
    let title = rawText
    let priority = selectedPriority
    let isFun = false
    let isChore = false
    let isQuick = false
    const tagIds: string[] = []

    // Parse Priority
    if (title.includes('!')) {
      priority = Priority.HIGH
      title = title.replace(/!/g, '')
    } else if (title.includes('-')) {
      priority = Priority.LOW
      title = title.replace(/-/g, '')
    }

    // Parse Flags
    if (title.includes('~is_fun')) {
      isFun = true
      title = title.replace('~is_fun', '')
    }
    if (title.includes('~is_chore')) {
      isChore = true
      title = title.replace('~is_chore', '')
    }
    if (title.includes('~is_quick')) {
      isQuick = true
      title = title.replace('~is_quick', '')
    }

    // Parse Tags (e.g. #tagname)
    const tagMatches = title.match(/#\w+/g)
    if (tagMatches) {
      for (const match of tagMatches) {
        const tagName = match.substring(1) // remove #

        // Find existing tag or create new one
        const existingTag = entity_tags.data.find(
          (t) => t.title.toLowerCase() === tagName.toLowerCase(),
        )

        if (existingTag) {
          tagIds.push(existingTag.id)
        } else {
          const newTagId = createId()
          try {
            await entity_tags.add({
              id: newTagId,
              title: tagName,
            })
            tagIds.push(newTagId)
          } catch (e) {
            console.error('Failed to create tag', e)
          }
        }
        title = title.replace(match, '')
      }
    }

    // Cleanup title
    title = title.replace(/\s+/g, ' ').trim()

    if (!title) return // Don't submit if it was just flags

    // Create Task
    try {
      await tasks.add({
        title,
        status: ProgressStatus.PLANNED,
        priority,
        is_fun: isFun,
        is_chore: isChore,
        is_quick: isQuick,
        tag_ids: tagIds,
      })

      // Reset logic
      setInputValue('')
      setSelectedPriority(Priority.MEDIUM)
    } catch (error) {
      console.error('Failed to create task', error)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      parseAndSubmit()
    }
  }

  return (
    <div ref={ref} className="w-full max-w-2xl mx-auto space-y-2">
      <div className="relative">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What's on your mind? #tag ~is_quick !"
          className="pr-24 h-12 text-lg shadow-sm border-2 border-border/50 focus-visible:border-primary/50"
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <Button
            size="icon-xs"
            variant={
              selectedPriority === Priority.HIGH ? 'destructive' : 'ghost'
            }
            onClick={() => setSelectedPriority(Priority.HIGH)}
            title="High Priority (!)"
          >
            <AlertCircle className="size-4" />
          </Button>
          <Button
            size="icon-xs"
            variant={selectedPriority === Priority.LOW ? 'secondary' : 'ghost'}
            onClick={() => setSelectedPriority(Priority.LOW)}
            title="Low Priority (-)"
          >
            <MinusCircle className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground px-2">
        <div className="flex gap-3">
          <span>
            Type <b>!</b> for high priority
          </span>
          <span>
            <b>#tag</b> to categorize
          </span>
          <span>
            <b>~is_quick</b> for quick wins
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span>Press Enter</span>
          <ArrowRight className="size-3" />
        </div>
      </div>
    </div>
  )
}
