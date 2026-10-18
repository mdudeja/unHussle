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
  icon: IconName
  color?: string
  size?: number
  className?: string
}) {
  return (
    <DynamicIcon
      name={icon}
      color={color}
      size={size ?? 12}
      className={className}
    />
  )
}
