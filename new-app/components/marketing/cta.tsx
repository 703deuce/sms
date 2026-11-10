import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl px-5 text-sm font-medium outline-none transition-all focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px'

export function PrimaryCta({
  href,
  children,
  className,
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        base,
        'h-11 bg-brand-gradient text-brand-foreground shadow-glow hover:brightness-110',
        className,
      )}
    >
      {children}
    </Link>
  )
}

export function SecondaryCta({
  href,
  children,
  className,
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        base,
        'h-11 border border-border bg-transparent text-foreground hover:bg-accent',
        className,
      )}
    >
      {children}
    </Link>
  )
}

export function TextCta({
  href,
  children,
  className,
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-sm',
        className,
      )}
    >
      {children}
    </Link>
  )
}
