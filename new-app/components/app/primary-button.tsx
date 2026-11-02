'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function PrimaryButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      className={cn(
        'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/85 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 disabled:shadow-none',
        className,
      )}
    />
  )
}
