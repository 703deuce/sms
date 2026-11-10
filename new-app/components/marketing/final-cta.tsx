import { ArrowRight } from 'lucide-react'
import { PrimaryCta, SecondaryCta } from './cta'
import { CreditChip } from './section'

export function FinalCta({
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  title: string
  description: string
  primaryHref: string
  primaryLabel: string
  secondaryHref: string
  secondaryLabel: string
}) {
  return (
    <section className="px-5 py-20 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-border bg-card px-6 py-14 text-center shadow-glow sm:px-12">
        <CreditChip>Start free · credits</CreditChip>
        <h2 className="mt-5 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          {title}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
          {description}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <PrimaryCta href={primaryHref}>
            {primaryLabel}
            <ArrowRight className="size-4" aria-hidden />
          </PrimaryCta>
          <SecondaryCta href={secondaryHref}>{secondaryLabel}</SecondaryCta>
        </div>
      </div>
    </section>
  )
}
