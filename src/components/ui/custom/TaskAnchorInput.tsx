import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  useEntrySearch,
  useWorkflowQuery,
  useWorkflowRuntime,
} from '@/workflows/hooks'
import type { EntryRecord } from '@c/workflows/contracts'

export function TaskAnchorInput({
  value,
  onChange,
  disabled,
}: {
  value: string | null
  onChange: (id: string | null) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const runtime = useWorkflowRuntime()
  const selected = useWorkflowQuery(
    {
      key: `detail:tasks:${value ?? ''}`,
      dependencies: ['tasks'],
      load: () => runtime.services.tasks.fetchById(value!),
    },
    !!value,
  )
  const search = useEntrySearch<EntryRecord>('tasks', open ? term : '')
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="w-full justify-start truncate"
          >
            {selected.data
              ? String(selected.data.title)
              : value
                ? 'Loading anchor…'
                : 'Choose an anchor task'}
          </Button>
        }
      />
      <PopoverContent className="space-y-2 w-80">
        <Input
          aria-label="Search anchor tasks"
          placeholder="Search tasks…"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            onChange(null)
            setOpen(false)
          }}
        >
          No anchor
        </Button>
        {search.isLoading && term && <p className="text-sm">Searching…</p>}
        {search.error && <p role="alert">Could not search tasks.</p>}
        <div className="max-h-60 overflow-y-auto">
          {search.data?.map((task) => (
            <Button
              key={task.id}
              type="button"
              variant="ghost"
              className="w-full justify-start truncate"
              onClick={() => {
                onChange(task.id)
                setOpen(false)
              }}
            >
              {String(task.title)}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
