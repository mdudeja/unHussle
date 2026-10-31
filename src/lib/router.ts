import App from '@/App'
import { AppErrorBoundary } from '@/components/app/AppErrorBoundary'
import HomePage from '@/pages/HomePage'
import {
  AreasPage,
  GoalsPage,
  ProjectsPage,
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
      { path: entityRoutes.projects, Component: ProjectsPage },
      { path: entityRoutes.areas, Component: AreasPage },
      { path: entityRoutes.goals, Component: GoalsPage },
      { path: entityRoutes.tasks, Component: TasksPage },
      { path: entityRoutes.urls, Component: UrlsPage },
      { path: entityRoutes.tags, Component: TagsPage },
    ],
  },
])

export { router }
