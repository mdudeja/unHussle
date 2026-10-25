import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'

const badgeVariants = cva(
  'group/badge inline-flex items-center justify-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden cursor-default',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground [&]:hover:bg-primary/80',
        secondary:
          'bg-secondary text-secondary-foreground [&]:hover:bg-secondary/80',
        destructive:
          'bg-destructive text-white [&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'border-border text-foreground [&]:hover:bg-accent [a&]:hover:text-accent-foreground',
        ghost: '[a&]:hover:bg-accent [&]:hover:text-accent-foreground',
        muted:
          'bg-muted border border-muted-foreground text-muted-foreground [&]:hover:bg-muted/80',
        link: 'text-primary underline-offset-4 [&]:hover:underline',
        link_border:
          'text-primary underline-offset-4 [&]:hover:underline border border-primary [&]:hover:bg-primary/10',
        primary_outline:
          'bg-secondary text-primary border border-primary [&]:hover:bg-primary/10 [&]:hover:text-primary',
        project:
          'border-blue-500 text-blue-500 [&]:hover:bg-blue-600 [&]:hover:text-white focus-visible:ring-blue-500/50 dark:focus-visible:ring-blue-400/40 dark:border-blue-400/60 dark:text-blue-400',
        area: 'border-green-500 text-green-500 [&]:hover:bg-green-600 [&]:hover:text-white focus-visible:ring-green-500/50 dark:focus-visible:ring-green-400/40 dark:border-green-400/60 dark:text-green-400',
        goal: 'border-yellow-600 text-yellow-600 [&]:hover:bg-yellow-400 [&]:hover:text-white focus-visible:ring-yellow-600/50 dark:focus-visible:ring-yellow-400/40 dark:border-yellow-400/60 dark:text-yellow-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant = 'default',
  render,
  ...props
}: useRender.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props,
    ),
    render,
    state: {
      slot: 'badge',
      variant,
    },
  })
}

export { Badge, badgeVariants }
