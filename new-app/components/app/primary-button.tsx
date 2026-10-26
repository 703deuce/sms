'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function PrimaryButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      className={cn(
        'relative bg-brand-gradient text-white shadow-sm ring-1 ring-inset ring-white/15 transition-[filter,box-shadow] hover:shadow-glow hover:brightness-110 active:brightness-95 disabled:opacity-60 disabled:shadow-none',
        className,
      )}
    />
  )
}
