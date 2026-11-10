import { cn } from '../../lib/utils'

export type FaqItem = { question: string; answer: string }

export function FaqList({ items, className }: { items: FaqItem[]; className?: string }) {
  return (
    <div className={cn('mx-auto max-w-3xl divide-y divide-border rounded-2xl border border-border bg-card', className)}>
      {items.map((item) => (
        <details key={item.question} className="group px-5 sm:px-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left text-base font-medium text-foreground outline-none marker:content-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            <span>{item.question}</span>
            <span
              aria-hidden
              className="grid size-6 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <p className="pb-5 text-sm leading-relaxed text-muted-foreground sm:text-[0.95rem]">{item.answer}</p>
        </details>
      ))}
    </div>
  )
}

export function faqJsonLd(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }
}
