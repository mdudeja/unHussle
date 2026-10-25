import { Badge } from '@/components/ui/badge'

export default function IconBadge({
  className,
  variant = 'default',
  icon,
  ...props
}: React.ComponentProps<typeof Badge> & { icon?: React.ReactNode }) {
  return (
    <Badge
      className={className}
      variant={variant}
      {...props}
      render={(props) => {
        return (
          <span {...props} className={props.className}>
            {icon && <span className="mr-1">{icon}</span>}
            {props.children}
          </span>
        )
      }}
    />
  )
}
