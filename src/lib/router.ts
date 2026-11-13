import { ExtensionPage } from '@/components/app/ExtensionContributions'
import App from '@/App'
import { AppErrorBoundary } from '@/components/app/AppErrorBoundary'
import HomePage from '@/pages/HomePage'
import { DayPage, WeekPage } from '@/pages/PlannerPages'
import {
  AreaDetailPage,
  AreasPage,
  GoalDetailPage,
  GoalsPage,
  ProjectDetailPage,
  ProjectsPage,
  ResourcesPage,
  TagDetailPage,
  TagsPage,
  TaskDetailPage,
  TasksPage,
  UrlDetailPage,
  UrlsPage,
} from '@/pages/EntityPages'
import { entityRoutes } from '@/lib/entityRoutes'
import { createBrowserRouter } from 'react-router'
import { SettingsPage } from '@/pages/SettingsPage'

const router = createBrowserRouter([
  {
    path: '/',
    Component: App,
    ErrorBoundary: AppErrorBoundary,
    children: [
      { index: true, Component: HomePage },
      { path: '/extensions/:id', Component: ExtensionPage },
      { path: '/day', Component: DayPage },
      { path: '/week', Component: WeekPage },
      { path: '/settings', Component: SettingsPage },
      { path: entityRoutes.projects, Component: ProjectsPage },
      { path: `${entityRoutes.projects}/:id`, Component: ProjectDetailPage },
      { path: entityRoutes.areas, Component: AreasPage },
      { path: `${entityRoutes.areas}/:id`, Component: AreaDetailPage },
      { path: entityRoutes.goals, Component: GoalsPage },
      { path: `${entityRoutes.goals}/:id`, Component: GoalDetailPage },
      { path: entityRoutes.tasks, Component: TasksPage },
      { path: `${entityRoutes.tasks}/:id`, Component: TaskDetailPage },
      { path: entityRoutes.urls, Component: UrlsPage },
      { path: `${entityRoutes.urls}/:id`, Component: UrlDetailPage },
      { path: entityRoutes.tags, Component: TagsPage },
      { path: `${entityRoutes.tags}/:id`, Component: TagDetailPage },
      { path: entityRoutes.resources, Component: ResourcesPage },
      // The editor is loaded on demand, so MDXEditor stays out of the main bundle.
      {
        path: `${entityRoutes.resources}/:id`,
        lazy: async () => ({
          Component: (await import('@/pages/ResourceEditorPage')).default,
        }),
      },
    ],
  },
])

export { router }
