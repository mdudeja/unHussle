import { Button } from '@/components/ui/button'
import React from 'react'

export default function IconButton({
  className,
  variant = 'default',
  size = 'default',
  icon,
  ...props
}: React.ComponentProps<typeof Button> & { icon?: React.ReactNode }) {
  return (
    <Button className={className} variant={variant} size={size} {...props}>
      {icon && <span className="mr-1">{icon}</span>}
      {props.children}
    </Button>
  )
}
