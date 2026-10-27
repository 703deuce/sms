'use client'

import Link from 'next/link'
import { CircleHelp } from 'lucide-react'
import { LogoMark } from '@/components/brand/logo-mark'
import { Button } from '@/components/ui/button'

/** §23 top bar — h56, Transovo logo, help + account slots */
export function RoomsTopBar({
  title = 'Transovo Rooms',
  right,
}: {
  title?: string
  right?: React.ReactNode
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <LogoMark className="size-8 shrink-0" />
        <span className="truncate text-sm font-semibold">{title}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="size-9" aria-label="Help">
          <CircleHelp className="size-[18px]" />
        </Button>
        {right}
      </div>
    </header>
  )
}

export function RoomsFullPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex min-h-dvh flex-col bg-background text-foreground">{children}</div>
  )
}

export function RoomsBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-[13px] text-muted-foreground hover:text-foreground">
      ← {label}
    </Link>
  )
}
