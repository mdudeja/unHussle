import { DynamicIcon, IconName } from 'lucide-react/dynamic'
/**
 * Resolve an icon name to the corresesponding icon component from the lucide-react package.
 **/
export function IconResolver({
  icon,
  color,
  size,
  className,
}: {
  // Icon names are stored as plain strings in the DB
  icon: IconName | (string & {})
  color?: string
  size?: number
  className?: string
}) {
  return (
    <DynamicIcon
      name={icon as IconName}
      color={color}
      size={size ?? 16}
      className={className}
    />
  )
}
