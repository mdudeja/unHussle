import React from 'react'
import ReactDOM from 'react-dom/client'
import { DatabaseProvider } from '@/contexts/DatabaseContext'
import { RouterProvider } from 'react-router'
import { router } from './lib/router'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <DatabaseProvider>
      <RouterProvider router={router} />
    </DatabaseProvider>
  </React.StrictMode>,
)
