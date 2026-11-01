import { isTauri } from '@tauri-apps/api/core'
import { FileIcon, FolderIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { pickFileUrl } from '@/lib/fileUrls'
import { Logger } from '@c/Logger'

export interface PickPathButtonsProps {
  onPick: (url: string) => void
  disabled?: boolean
}

/** "Pick file" / "Pick folder" buttons that return a file:// URL. Tauri only. */
export function PickPathButtons({ onPick, disabled }: PickPathButtonsProps) {
  if (!isTauri()) return null

  const pick = (directory: boolean) => {
    pickFileUrl({ directory })
      .then((url) => url && onPick(url))
      .catch((error) => {
        Logger.getInstance().error('Failed to pick a path', { error })
      })
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={disabled}
        onClick={() => pick(false)}
        title="Pick file"
        aria-label="Pick file"
      >
        <FileIcon className="size-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={disabled}
        onClick={() => pick(true)}
        title="Pick folder"
        aria-label="Pick folder"
      >
        <FolderIcon className="size-4" />
      </Button>
    </>
  )
}
