import { isTauri } from '@tauri-apps/api/core'
import IconBadge from '@/components/ui/custom/IconBadge'
import { FileIcon, FolderOpenIcon, LinkIcon } from 'lucide-react'
import { trimString } from '@/components/ui/utils/misc'
import { fileUrlName, isFileUrl, openLink, revealLink } from '@/lib/fileUrls'

export default function UrlView({ url, key }: { url: string; key?: string }) {
  const fileUrl = isFileUrl(url)
  const label = fileUrl ? fileUrlName(url) : url

  return (
    <span key={key} className="inline-flex items-center gap-1" title={url}>
      <IconBadge
        variant="link_border"
        className="text-xs cursor-pointer"
        icon={
          fileUrl ? (
            <FileIcon className="h-4 w-4" />
          ) : (
            <LinkIcon className="h-4 w-4" />
          )
        }
        onClick={() => void openLink(url)}
      >
        {trimString(label, 24)}
      </IconBadge>
      {fileUrl && isTauri() && (
        <IconBadge
          variant="link_border"
          className="text-xs cursor-pointer"
          icon={<FolderOpenIcon className="h-4 w-4" />}
          onClick={() => void revealLink(url)}
          aria-label="Show in folder"
          title="Show in folder"
        />
      )}
    </span>
  )
}
