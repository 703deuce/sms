'use client'

import { Search } from 'lucide-react'
import { OPUS_CARD, OPUS_SEARCH_INPUT } from '@/newui-transplant/components/app/opus-surfaces'
import { cn } from '@/lib/utils'

/** New UI 2 data table shell — toolbar + table + optional footer in one card. */
export function OpusDataSurface({
  toolbar,
  footer,
  children,
  className,
}: {
  toolbar?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn(OPUS_CARD, 'overflow-hidden', className)}>
      {toolbar ? (
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          {toolbar}
        </div>
      ) : null}
      {children}
      {footer ? <footer className="border-t px-4 py-3">{footer}</footer> : null}
    </section>
  )
}

export function ArStatGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', className)}>{children}</div>
}

export function OpusSearchField({
  id,
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
}) {
  return (
    <div className={cn('relative min-w-[200px] flex-1', className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <label htmlFor={id} className="sr-only">{label}</label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={OPUS_SEARCH_INPUT}
      />
    </div>
  )
}

export function OpusTableSkeleton({ rows = 6, label }: { rows?: number; label: string }) {
  return (
    <div className="space-y-0 divide-y p-2" aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-md bg-muted/40 mx-2 my-1" />
      ))}
    </div>
  )
}
