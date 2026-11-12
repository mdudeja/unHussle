import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { TaskContextList } from '@/components/app/task-context-list'
import { contextCountOf } from '@/lib/task-context'
import { useTaskContext } from '@/workflows/hooks'

/**
 * A chip on the task card that opens everything the task brings along: its
 * own resources and links, then those of its project, goal and area.
 */
export function TaskContextSheet({ taskId }: { taskId: string }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const context = useTaskContext(taskId)
  const data = context.data
  const count = data
    ? contextCountOf(data.own) +
      data.inherited.reduce((sum, group) => sum + contextCountOf(group), 0)
    : 0
  if (!data || count === 0) return null

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Paperclip className="size-4" />
        {count} {count === 1 ? 'resource' : 'resources'}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Resources for this task</SheetTitle>
            <SheetDescription>
              Including those from its project, goal and area.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <TaskContextList
              context={data}
              onOpen={(route) => {
                setOpen(false)
                void navigate(route)
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
