import React from 'react'
import { cn } from '@/utils/cn'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'danger'
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default:
        'border-transparent bg-sage text-white shadow-calm-sm hover:bg-sage2',
      secondary: 'border-transparent bg-surface2 text-text hover:bg-border/50',
      outline: 'text-text border-border',
      danger:
        'border-transparent bg-danger text-white shadow-calm-sm hover:bg-danger/90',
    }

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          variants[variant],
          className,
        )}
        {...props}
      />
    )
  },
)
Badge.displayName = 'Badge'
