import { useEffect, useSyncExternalStore } from 'react'
import { useWorkflowQuery, useWorkflowRuntime } from '@/workflows/hooks'
import { extensionService } from '@/services/extensions'

export function useInstalledExtensions() {
  return useWorkflowQuery({
    key: 'extensions:list',
    dependencies: ['extensions'],
    load: extensionService.list,
  })
}

/** Loads enabled frontend entries whenever the server's list changes. */
export function useExtensionActivation() {
  const { extensionLoader } = useWorkflowRuntime()
  const { data } = useInstalledExtensions()
  useEffect(() => {
    if (data) void extensionLoader.sync(data.extensions)
  }, [extensionLoader, data])
}

/** Frontend load failures, keyed by extension ID. */
export function useExtensionLoadErrors() {
  const { errors } = useWorkflowRuntime().extensionLoader
  return useSyncExternalStore(errors.subscribe, errors.snapshot)
}
