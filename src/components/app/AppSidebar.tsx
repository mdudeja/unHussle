import { ExtensionMenus } from '@/components/app/ExtensionContributions'
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
import { Link, useLocation } from 'react-router'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { EntityRouteKey } from '@/lib/entityRoutes'
import { VERSION } from '@c/version'

const menuItems = [
  {
    label: 'Projects',
    route: 'projects' as const,
    fallbackIcon: FolderKanban,
  },
  {
    label: 'Areas',
    route: 'areas' as const,
    fallbackIcon: GitGraph,
  },
  {
    label: 'Goals',
    route: 'goals' as const,
    fallbackIcon: Goal,
  },
  {
    label: 'Tasks',
    route: 'tasks' as const,
    fallbackIcon: ListTodo,
  },
  {
    label: 'Resources',
    route: 'resources' as const,
    fallbackIcon: FileText,
  },
  {
    label: 'URLs',
    route: 'urls' as const,
    fallbackIcon: LinkIcon,
  },
  {
    label: 'Tags',
    route: 'tags' as const,
    fallbackIcon: Hash,
  },
]
const EntityMenuEntry = ({
  label,
  route,
  fallbackIcon: FallbackIcon,
  activeId,
}: {
  label: string
  route: EntityRouteKey
  fallbackIcon: LucideIcon
  activeId: string | null
}) => {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton tooltip={label} isActive={route === activeId}>
        <Link to={route} className="flex items-center gap-2 px-2 py-1 w-full">
          <FallbackIcon className="h-4 w-4" />
          <span className="truncate">{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export const AppSidebarComponent = () => {
  // Highlight the open item
  const { pathname } = useLocation()
  const getActiveRoute = () => pathname.slice(1)

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
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem key="/scheduler/settings">
              <SidebarMenuButton isActive={pathname === '/scheduler/settings'}>
                <Link to="/scheduler/settings" className="px-2 py-1 w-full">
                  Preferences
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <ExtensionMenus />
        <SidebarGroup>
          <SidebarGroupLabel>Your Collections</SidebarGroupLabel>
          <SidebarMenu>
            {menuItems.map((group) => (
              <EntityMenuEntry
                key={group.label}
                activeId={getActiveRoute()}
                {...group}
              />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
