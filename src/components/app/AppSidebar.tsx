import { ExtensionMenus } from './ExtensionContributions'
import { useEntryList } from '@/workflows/hooks'
import type { LucideIcon } from 'lucide-react'
import {
  FileText,
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
import {
  EntityRouteKey,
  entityRoutes,
  entitySearchParams,
  getEntityItemRoute,
} from '@/lib/entityRoutes'
import { VERSION } from '@c/version'

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
      title={`View all ${label.toLowerCase()}`}
      className="aspect-auto h-5 w-auto px-1.5 text-xs text-muted-foreground"
    >
      <Link to={entityRoutes[route]}>All</Link>
    </SidebarGroupAction>
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.id}>
          <SidebarMenuButton
            tooltip={item.label}
            isActive={item.id === activeId}
          >
            <Link
              to={getEntityItemRoute(route, item.id)}
              className="flex items-center gap-2 px-2 py-1"
            >
              {item.icon ? (
                <IconResolver
                  icon={item.icon}
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
  const projectsQuery = useEntryList('projects')
  const areasQuery = useEntryList('areas')
  const goalsQuery = useEntryList('goals')
  const tasksQuery = useEntryList('tasks')
  const urlsQuery = useEntryList('urls')
  const tagsQuery = useEntryList('tags')
  const resourcesQuery = useEntryList('resources')

  const groups = [
    {
      label: 'Projects',
      route: 'projects' as const,
      fallbackIcon: FolderKanban,
      isLoading: projectsQuery.isLoading,
      items: getRecent(projectsQuery.data ?? []).map((p) => ({
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
      isLoading: areasQuery.isLoading,
      items: getRecent(areasQuery.data ?? []).map((a) => ({
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
      isLoading: goalsQuery.isLoading,
      items: getRecent(goalsQuery.data ?? []).map((g) => ({
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
      isLoading: tasksQuery.isLoading,
      items: getRecent(tasksQuery.data ?? []).map((t) => ({
        id: t.id,
        label: t.title,
      })),
    },
    {
      label: 'Resources',
      route: 'resources' as const,
      fallbackIcon: FileText,
      isLoading: resourcesQuery.isLoading,
      items: getRecent(resourcesQuery.data ?? []).map((r) => ({
        id: r.id,
        label: r.title,
      })),
    },
    {
      label: 'URLs',
      route: 'urls' as const,
      fallbackIcon: LinkIcon,
      isLoading: urlsQuery.isLoading,
      items: getRecent(urlsQuery.data ?? []).map((u) => ({
        id: u.id,
        label: u.title || u.parts?.hostname || u.url,
      })),
    },
    {
      label: 'Tags',
      route: 'tags' as const,
      fallbackIcon: Hash,
      isLoading: tagsQuery.isLoading,
      items: getRecent(tagsQuery.data ?? []).map((t) => ({
        id: t.id,
        label: t.title,
        color: t.color,
      })),
    },
  ]

  // Highlight the item whose list page is open with its `?id=` selected.
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  // Resources open in their editor (`/resources/:id`) instead.
  const getActiveId = (route: EntityRouteKey) =>
    route === 'resources'
      ? pathname.startsWith(`${entityRoutes.resources}/`)
        ? decodeURIComponent(pathname.slice(entityRoutes.resources.length + 1))
        : null
      : pathname === entityRoutes[route]
        ? searchParams.get(entitySearchParams.id)
        : null

  return (
    <Sidebar>
      <SidebarHeader>
        <Link to="/" className="px-2 text-lg font-semibold">
          unHussle{' '}
          <span className="text-xs text-muted-foreground">v{VERSION}</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Your pace</SidebarGroupLabel>
          <SidebarMenu>
            {[
              ['/', 'Next task'],
              ['/day', 'Day'],
              ['/week', 'Week'],
              ['/scheduler/settings', 'Preferences'],
            ].map(([path, label]) => (
              <SidebarMenuItem key={path}>
                <SidebarMenuButton isActive={pathname === path}>
                  <Link to={path} className="px-2 py-1 w-full">
                    {label}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        <ExtensionMenus />
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
