import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Section({
  id,
  eyebrow,
  title,
  description,
  children,
  className,
  tone = 'default',
}: {
  id?: string
  eyebrow?: string
  title?: ReactNode
  description?: ReactNode
  children?: ReactNode
  className?: string
  tone?: 'default' | 'raised'
}) {
  return (
    <section
      id={id}
      className={cn(
        'relative px-5 py-20 sm:px-8 sm:py-24 lg:py-28',
        tone === 'raised' && 'bg-card/40',
        className,
      )}
    >
      <div className="mx-auto w-full max-w-6xl">
        {(eyebrow || title || description) && (
          <header className="mx-auto mb-12 max-w-3xl text-center sm:mb-16">
            {eyebrow ? (
              <p className="mb-3 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-brand">
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h2 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mx-auto mt-4 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                {description}
              </p>
            ) : null}
          </header>
        )}
        {children}
      </div>
    </section>
  )
}

export function CreditChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-0.5 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </span>
  )
}
