import { ExtensionPage } from '@/components/app/ExtensionContributions'
import App from '@/App'
import { AppErrorBoundary } from '@/components/app/AppErrorBoundary'
import HomePage from '@/pages/HomePage'
import { DayPage, WeekPage, SchedulerSettingsPage } from '@/pages/PlannerPages'
import {
  AreasPage,
  GoalsPage,
  ProjectsPage,
  ResourcesPage,
  TagsPage,
  TasksPage,
  UrlsPage,
} from '@/pages/EntityPages'
import { entityRoutes } from '@/lib/entityRoutes'
import { createBrowserRouter } from 'react-router'

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
      { path: '/scheduler/settings', Component: SchedulerSettingsPage },
      { path: entityRoutes.projects, Component: ProjectsPage },
      { path: entityRoutes.areas, Component: AreasPage },
      { path: entityRoutes.goals, Component: GoalsPage },
      { path: entityRoutes.tasks, Component: TasksPage },
      { path: entityRoutes.urls, Component: UrlsPage },
      { path: entityRoutes.tags, Component: TagsPage },
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
