import { Link } from 'react-router'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { cn } from '@/lib/utils'

type ListItemProps = {
  title: string
  href: string
  /** Hidden when compact. */
  media?: React.ReactNode
  /** Shown next to the title, e.g. status and priority icons. */
  indicators?: React.ReactNode
  /** The muted second line, e.g. dates and collections. */
  meta?: React.ReactNode
  actions?: React.ReactNode
  error?: string | null
  /** Present while the list is in selection mode. */
  selection?: { isSelected: boolean; onToggle: () => void }
  /** A denser row, e.g. for a day in the week view. */
  isCompact?: boolean
  className?: string
}

/**
 * One row of a list. Only the title link and the controls are interactive,
 * so the row never nests buttons inside a button.
 */
export function ListItem({
  title,
  href,
  media,
  indicators,
  meta,
  actions,
  error,
  selection,
  isCompact = false,
  className,
}: ListItemProps) {
  return (
    <li>
      <Item
        variant="outline"
        size={isCompact ? 'xs' : 'sm'}
        className={cn(
          'rounded-lg border-border/60 bg-card shadow-calm-sm hover:shadow-calm',
          selection?.isSelected && 'border-primary bg-primary/5 shadow-calm',
          className,
        )}
      >
        {selection && (
          <Checkbox
            checked={selection.isSelected}
            onCheckedChange={selection.onToggle}
            aria-label={`Select ${title}`}
          />
        )}
        {media && !isCompact && <ItemMedia>{media}</ItemMedia>}
        <ItemContent className="min-w-0">
          <ItemTitle className="w-full">
            <Link to={href} className="truncate hover:underline">
              {title}
            </Link>
            {indicators}
          </ItemTitle>
          {meta && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {meta}
            </div>
          )}
        </ItemContent>
        {actions && <ItemActions>{actions}</ItemActions>}
        {error && (
          <p role="alert" className="basis-full text-sm text-destructive">
            {error}
          </p>
        )}
      </Item>
    </li>
  )
}
