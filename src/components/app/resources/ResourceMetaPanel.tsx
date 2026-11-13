import { useRef, useState } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { FolderOpen, Link2, Tag as TagIcon, Type } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TagsInput } from '@/components/ui/custom/TagsInput'
import {
  EntityRefsInput,
  type EntityRef,
} from '@/components/ui/custom/EntityRefsInput'
import { useStore } from '@/store'
import type { HydratedResource } from '@c/types/Hydrated'
import type { TagInput } from '@c/types'
import { Logger } from '@c/Logger'
import { useHotkey } from '@/hooks/use-keydown-mgr'

/** Title, tags and links of a resource; each change is saved right away. */
export function ResourceMetaPanel({
  resource,
  path,
}: {
  resource: HydratedResource
  path: string | null
}) {
  const { update } = useStore((state) => state.resources)
  const titleRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState(resource.title)
  const [error, setError] = useState<string | null>(null)

  const save = async (changes: Record<string, unknown>) => {
    setError(null)
    try {
      await update(resource.id, changes)
    } catch (error) {
      Logger.getInstance().error('Failed to update resource', { error })
      setError(
        error instanceof Error && error.message
          ? error.message
          : 'Could not save the change.',
      )
    }
  }

  const saveTitle = () => {
    const next = title.trim()
    if (!next) return setTitle(resource.title)
    if (next !== resource.title) void save({ title: next })
  }

  // Blurring saves the title, see `onBlur`.
  useHotkey('resource.title.save', () => titleRef.current?.blur(), titleRef)
  useHotkey(
    'resource.title.revert',
    () => setTitle(resource.title),
    titleRef,
  )

  return (
    <aside className="flex w-full flex-col gap-4 lg:w-72">
      <div className="space-y-2">
        <Label htmlFor="resource-title">
          <Type className="size-4 text-muted-foreground" />
          Title
        </Label>
        <Input
          id="resource-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          ref={titleRef}
          onBlur={saveTitle}
        />
        <p className="text-xs text-muted-foreground">
          Renaming also renames the file.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="resource-tags">
          <TagIcon className="size-4 text-muted-foreground" />
          Tags
        </Label>
        <TagsInput
          id="resource-tags"
          value={resource.tags}
          onChange={(tags: TagInput[]) => void save({ tags })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="resource-links">
          <Link2 className="size-4 text-muted-foreground" />
          Linked to
        </Label>
        <EntityRefsInput
          id="resource-links"
          kinds={['tasks', 'projects', 'areas', 'goals']}
          value={resource.links}
          onChange={(links: EntityRef[]) =>
            void save({
              links: links.map(({ kind, id }) => ({ kind, id })),
            })
          }
        />
        <p className="text-xs text-muted-foreground">
          Tasks under a linked project, goal or area see it too.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      {isTauri() && path && !resource.missing && (
        <Button
          variant="outline"
          className="justify-start"
          onClick={() =>
            void revealItemInDir(path).catch((error: unknown) =>
              Logger.getInstance().error('Failed to reveal file', { error }),
            )
          }
        >
          <FolderOpen className="size-4" />
          Show in folder
        </Button>
      )}
      {path && (
        <p className="break-all text-xs text-muted-foreground">{path}</p>
      )}
    </aside>
  )
}
