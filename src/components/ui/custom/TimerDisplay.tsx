import React from 'react'
import { cn } from '@/utils/cn'
import { formatDuration } from '@/utils/timeUtils'

interface TimerDisplayProps extends React.HTMLAttributes<HTMLDivElement> {
  seconds: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'muted'
}

export const TimerDisplay = React.forwardRef<HTMLDivElement, TimerDisplayProps>(
  ({ className, seconds, size = 'md', variant = 'default', ...props }, ref) => {
    const sizeClasses = {
      sm: 'text-sm',
      md: 'text-xl',
      lg: 'text-3xl',
      xl: 'text-6xl',
    }

    const variantClasses = {
      default: 'text-text font-bold',
      muted: 'text-muted font-medium',
    }

    return (
      <div
        ref={ref}
        className={cn(
          'font-mono tabular-nums tracking-wider',
          sizeClasses[size],
          variantClasses[variant],
          className,
        )}
        {...props}
      >
        {formatDuration(seconds)}
      </div>
    )
  },
)
TimerDisplay.displayName = 'TimerDisplay'
