import { useEffect } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  FolderKanban,
  GitGraph,
  Goal,
  Hash,
  Link as LinkIcon,
  ListTodo,
} from 'lucide-react'
import { Link, useLocation, useSearchParams } from 'react-router'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { IconResolver } from '@/components/ui/utils/IconResolver'
import { useStore } from '@/store'
import {
  EntityRouteKey,
  entityRoutes,
  entitySearchParams,
  getEntityItemRoute,
} from '@/lib/entityRoutes'
import { Logger } from '@c/Logger'

const RECENT_ITEMS_LIMIT = 5

type SidebarItem = {
  id: string
  label: string
  icon?: string | null
  color?: string | null
}

type RecentRecord = { updated_at: number }

// Most recently updated records first, capped at RECENT_ITEMS_LIMIT.
const getRecent = <T extends RecentRecord>(records: T[]) =>
  [...records]
    .sort((a, b) => b.updated_at - a.updated_at)
    .slice(0, RECENT_ITEMS_LIMIT)

const SidebarRecentGroup = ({
  label,
  route,
  fallbackIcon: FallbackIcon,
  items,
  isLoading,
  activeId,
}: {
  label: string
  route: EntityRouteKey
  fallbackIcon: LucideIcon
  items: SidebarItem[]
  isLoading: boolean
  activeId: string | null
}) => (
  <SidebarGroup>
    <SidebarGroupLabel>{label}</SidebarGroupLabel>
    <SidebarGroupAction
      asChild
      title={`View all ${label.toLowerCase()}`}
      className="aspect-auto h-5 w-auto px-1.5 text-xs text-muted-foreground"
    >
      <Link to={entityRoutes[route]}>All</Link>
    </SidebarGroupAction>
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.id}>
          <SidebarMenuButton
            asChild
            tooltip={item.label}
            isActive={item.id === activeId}
          >
            <Link to={getEntityItemRoute(route, item.id)}>
              {item.icon ? (
                <IconResolver
                  icon={item.icon as any}
                  color={item.color ?? undefined}
                  className="h-4 w-4"
                />
              ) : (
                <FallbackIcon
                  className="h-4 w-4"
                  color={item.color ?? undefined}
                />
              )}
              <span className="truncate">{item.label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
      {items.length === 0 && (
        <SidebarMenuItem>
          <span className="px-2 text-xs text-muted-foreground">
            {isLoading ? 'Loading...' : `No ${label.toLowerCase()} yet`}
          </span>
        </SidebarMenuItem>
      )}
    </SidebarMenu>
  </SidebarGroup>
)

export const AppSidebarComponent = () => {
  const projects = useStore((state) => state.projects)
  const areas = useStore((state) => state.areas)
  const goals = useStore((state) => state.goals)
  const tasks = useStore((state) => state.tasks)
  const urls = useStore((state) => state.urls)
  const tags = useStore((state) => state.tags)

  // Pages already fetch the entities they need; only fetch what is still empty.
  useEffect(() => {
    const state = useStore.getState()
    const slices = [
      state.projects,
      state.areas,
      state.goals,
      state.tasks,
      state.urls,
      state.tags,
    ]
    slices.forEach((slice) => {
      if (slice.data.length > 0 || slice.isLoading) {
        return
      }
      slice.fetch().catch((error) => {
        Logger.getInstance().error(`Failed to fetch sidebar data: ${error}`)
      })
    })
  }, [])

  const groups = [
    {
      label: 'Projects',
      route: 'projects' as const,
      fallbackIcon: FolderKanban,
      isLoading: projects.isLoading,
      items: getRecent(projects.data).map((p) => ({
        id: p.id,
        label: p.title,
        icon: p.icon,
        color: p.color,
      })),
    },
    {
      label: 'Areas',
      route: 'areas' as const,
      fallbackIcon: GitGraph,
      isLoading: areas.isLoading,
      items: getRecent(areas.data).map((a) => ({
        id: a.id,
        label: a.title,
        icon: a.icon,
        color: a.color,
      })),
    },
    {
      label: 'Goals',
      route: 'goals' as const,
      fallbackIcon: Goal,
      isLoading: goals.isLoading,
      items: getRecent(goals.data).map((g) => ({
        id: g.id,
        label: g.title,
        icon: g.icon,
        color: g.color,
      })),
    },
    {
      label: 'Tasks',
      route: 'tasks' as const,
      fallbackIcon: ListTodo,
      isLoading: tasks.isLoading,
      items: getRecent(tasks.data).map((t) => ({
        id: t.id,
        label: t.title,
      })),
    },
    {
      label: 'URLs',
      route: 'urls' as const,
      fallbackIcon: LinkIcon,
      isLoading: urls.isLoading,
      items: getRecent(urls.data).map((u) => ({
        id: u.id,
        label: u.title || u.parts?.hostname || u.url,
      })),
    },
    {
      label: 'Tags',
      route: 'tags' as const,
      fallbackIcon: Hash,
      isLoading: tags.isLoading,
      items: getRecent(tags.data).map((t) => ({
        id: t.id,
        label: t.title,
        color: t.color,
      })),
    },
  ]

  // Highlight the item whose list page is open with its `?id=` selected.
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const getActiveId = (route: EntityRouteKey) =>
    pathname === entityRoutes[route]
      ? searchParams.get(entitySearchParams.id)
      : null

  return (
    <Sidebar>
      <SidebarHeader>
        <Link to="/" className="px-2 text-lg font-semibold">
          unHussle
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarRecentGroup
            key={group.label}
            activeId={getActiveId(group.route)}
            {...group}
          />
        ))}
      </SidebarContent>
    </Sidebar>
  )
}
