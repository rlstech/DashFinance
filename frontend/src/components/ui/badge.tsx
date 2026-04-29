import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'destructive' | 'warning' | 'outline'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs font-black uppercase tracking-wide',
        {
          'bg-dark text-white': variant === 'default',
          'bg-emerald-600 text-white': variant === 'success',
          'bg-red-600 text-white': variant === 'destructive',
          'bg-brand text-dark': variant === 'warning',
          'border-2 border-dark text-dark': variant === 'outline',
        },
        className
      )}
      {...props}
    />
  )
}
