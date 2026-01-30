import App from '@/App'
import HomePage from '@/pages/HomePage'
import { createBrowserRouter } from 'react-router'

const router = createBrowserRouter([
  {
    path: '/',
    Component: App,
    children: [{ index: true, Component: HomePage }],
  },
])

export { router }
