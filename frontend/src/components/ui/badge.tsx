import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'destructive' | 'warning' | 'outline'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        {
          'bg-primary/20 text-primary': variant === 'default',
          'bg-emerald-500/20 text-emerald-400': variant === 'success',
          'bg-red-500/20 text-red-400': variant === 'destructive',
          'bg-amber-500/20 text-amber-400': variant === 'warning',
          'border border-border text-muted-foreground': variant === 'outline',
        },
        className
      )}
      {...props}
    />
  )
}
