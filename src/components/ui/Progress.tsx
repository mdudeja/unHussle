import React from 'react'
import { cn } from '@/utils/cn'

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  max?: number
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, ...props }, ref) => {
    const percentage = Math.min(Math.max(0, (value / max) * 100), 100)

    return (
      <div
        ref={ref}
        className={cn(
          'relative h-2 w-full overflow-hidden rounded-full bg-surface2',
          className,
        )}
        {...props}
      >
        <div
          className="h-full w-full flex-1 bg-sage transition-all duration-300 ease-in-out"
          style={{ transform: `translateX(-${100 - percentage}%)` }}
        />
      </div>
    )
  },
)
Progress.displayName = 'Progress'
