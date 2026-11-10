import { createElement, useState, useSyncExternalStore } from 'react'
import { Link, useParams } from 'react-router'
import { useWorkflowRuntime } from '@/workflows/hooks'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import { Logger } from '@c/Logger'
import type { ExtensionMenu } from '@/extensions/sdk'

function useContributions() {
  const { contributions } = useWorkflowRuntime().extensions
  return useSyncExternalStore(
    contributions.subscribe,
    contributions.snapshot,
    contributions.snapshot,
  )
}
function MenuItem({ menu }: { menu: ExtensionMenu }) {
  const [error, setError] = useState(false)
  return (
    <SidebarMenuItem>
      {menu.viewId ? (
        <SidebarMenuButton
          render={
            <Link to={`/extensions/${encodeURIComponent(menu.viewId)}`} />
          }
        >
          {menu.label}
        </SidebarMenuButton>
      ) : (
        <SidebarMenuButton
          onClick={() => {
            setError(false)
            Promise.resolve()
              .then(() => menu.run?.())
              .catch((error: unknown) => {
                setError(true)
                Logger.getInstance().error('Extension menu action failed', {
                  error,
                })
              })
          }}
        >
          {menu.label}
        </SidebarMenuButton>
      )}
      {error && <span role="alert">Could not complete this action.</span>}
    </SidebarMenuItem>
  )
}

export function ExtensionMenus() {
  const { menus } = useContributions()
  if (!menus.length) return null
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Extensions</SidebarGroupLabel>
      <SidebarMenu>
        {menus.map((menu) => (
          <MenuItem key={menu.id} menu={menu} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}

export function ExtensionPage() {
  const { id } = useParams()
  const { views } = useContributions()
  const view = views.find((view) => view.id === id)
  return view ? (
    <section className="p-4">{createElement(view.component)}</section>
  ) : (
    <p>This extension view is unavailable.</p>
  )
}
