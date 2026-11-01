import { isTauri } from '@tauri-apps/api/core'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { FileText, FolderOpen } from 'lucide-react'
import { useNavigate } from 'react-router'
import type { HydratedResource } from '@c/types/Hydrated'
import { getResourceRoute } from '@/lib/entityRoutes'
import { useWorkflowRuntime } from '@/workflows/hooks'
import type { EntityAction } from './types'

/** Open a resource in its editor, or show its file in the file manager. */
export const useResourceActions = <
  T extends Pick<HydratedResource, 'id' | 'missing'>,
>(): EntityAction<T>[] => {
  const navigate = useNavigate()
  const runtime = useWorkflowRuntime()
  return [
    {
      id: 'open',
      label: 'Open',
      icon: FileText,
      run: (resource) => navigate(getResourceRoute(resource.id)),
    },
    {
      id: 'reveal',
      label: 'Show in folder',
      icon: FolderOpen,
      variant: 'outline',
      run: async (resource) => {
        const { path } = await runtime.vault.content(resource.id)
        if (path) await revealItemInDir(path)
      },
      isVisible: (resource) => isTauri() && !resource.missing,
    },
  ]
}
