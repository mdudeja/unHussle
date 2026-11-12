import { Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router'
import type { HydratedTask } from '@c/types/Hydrated'
import { useTaskContext } from '@/workflows/hooks'
import { Button } from '@/components/ui/button'
import { EntityListPage } from '@/components/pages/EntityListPage'
import { EntityDetailPage } from '@/components/pages/EntityDetailPage'
import { TaskContextList } from '@/components/app/task-context-list'
import { ContainerTabs } from '@/pages/container-tabs'
import {
  areasList,
  goalsList,
  projectsList,
  resourcesList,
  tagsList,
  tasksList,
  urlsList,
} from '@/pages/entity-list-configs'

export const ProjectsPage = () => <EntityListPage config={projectsList} />
export const AreasPage = () => <EntityListPage config={areasList} />
export const GoalsPage = () => <EntityListPage config={goalsList} />
export const TasksPage = () => <EntityListPage config={tasksList} />
export const UrlsPage = () => <EntityListPage config={urlsList} />
export const TagsPage = () => <EntityListPage config={tagsList} />
export const ResourcesPage = () => (
  <EntityListPage
    config={{
      ...resourcesList,
      description:
        'Markdown notes in your vault, linked to tasks and collections.',
    }}
  />
)

export const ProjectDetailPage = () => (
  <EntityDetailPage
    config={{
      list: projectsList,
      renderBody: (item) => (
        <ContainerTabs
          kind="projects"
          id={item.id}
          relations={['resources', 'urls', 'tags']}
        />
      ),
    }}
  />
)

export const AreaDetailPage = () => (
  <EntityDetailPage
    config={{
      list: areasList,
      renderBody: (item) => (
        <ContainerTabs
          kind="areas"
          id={item.id}
          relations={['projects', 'goals', 'resources', 'urls', 'tags']}
        />
      ),
    }}
  />
)

export const GoalDetailPage = () => (
  <EntityDetailPage
    config={{
      list: goalsList,
      renderBody: (item) => (
        <ContainerTabs
          kind="goals"
          id={item.id}
          relations={['projects', 'resources', 'urls', 'tags']}
        />
      ),
    }}
  />
)

const supporterRelations = ['projects', 'areas', 'goals', 'resources'] as const

export const UrlDetailPage = () => (
  <EntityDetailPage
    config={{
      list: urlsList,
      renderBody: (item) => (
        <ContainerTabs
          kind="urls"
          id={item.id}
          relations={[...supporterRelations]}
        />
      ),
    }}
  />
)

export const TagDetailPage = () => (
  <EntityDetailPage
    config={{
      list: tagsList,
      renderBody: (item) => (
        <ContainerTabs
          kind="tags"
          id={item.id}
          relations={[...supporterRelations]}
        />
      ),
    }}
  />
)

function TaskContextSection({ task }: { task: HydratedTask }) {
  const navigate = useNavigate()
  const context = useTaskContext(task.id)
  const data = context.data
  const isEmpty =
    data &&
    [data.own, ...data.inherited].every(
      (items) =>
        items.resources.length + items.urls.length + items.tags.length === 0,
    )

  const renderContent = () => {
    if (context.error) {
      return (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-sm text-destructive">
            Could not load this task&apos;s resources. Try again.
          </p>
          <Button type="button" variant="outline" onClick={context.retry}>
            Try again
          </Button>
        </div>
      )
    }
    if (!data) {
      return (
        <Loader2
          className="size-5 animate-spin text-muted-foreground"
          aria-label="Loading resources"
        />
      )
    }
    if (isEmpty) {
      return (
        <p className="text-sm text-muted-foreground">
          No resources, links or tags yet. Use Edit to add some.
        </p>
      )
    }
    return (
      <TaskContextList
        context={data}
        onOpen={(route) => void navigate(route)}
      />
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Resources and links</h2>
      {renderContent()}
    </section>
  )
}

export const TaskDetailPage = () => (
  <EntityDetailPage
    config={{
      list: tasksList,
      renderBody: (item) => <TaskContextSection key={item.id} task={item} />,
    }}
  />
)
