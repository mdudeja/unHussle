import { isTauri } from '@tauri-apps/api/core'
import IconBadge from '@/components/ui/custom/IconBadge'
import { LinkIcon } from 'lucide-react'
import { openUrl, revealItemInDir } from '@tauri-apps/plugin-opener'
import { trimString } from '@/components/ui/utils/misc'
import { Link } from 'react-router'
import { Logger } from '@c/Logger'

export default function UrlView({ url, key }: { url: string; key?: string }) {
  if (isTauri()) {
    return tauriView(url, key)
  }

  return browserView(url)
}

function tauriView(url: string, key?: string) {
  return (
    <IconBadge
      key={key}
      variant="link_border"
      className="text-xs cursor-pointer"
      icon={<LinkIcon className="h-4 w-4" />}
      onClick={() => {
        if (url.startsWith('http') || url.startsWith('www')) {
          openUrl(url).catch((err) => {
            Logger.getInstance().error(`Failed to open URL: ${String(err)}`)
          })
        } else {
          revealItemInDir(url).catch((err) => {
            Logger.getInstance().error(
              `Failed to reveal file in directory: ${String(err)}`,
            )
          })
        }
      }}
    >
      {trimString(url, 24)}...
    </IconBadge>
  )
}

function browserView(url: string, key?: string) {
  return (
    <IconBadge
      key={key}
      variant="link_border"
      className="text-xs cursor-pointer"
      icon={<LinkIcon className="h-4 w-4" />}
    >
      <Link to={url} target="_blank" rel="noopener noreferrer">
        {trimString(url, 24)}...
      </Link>
    </IconBadge>
  )
}
