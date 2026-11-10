import Link from 'next/link'
import { hrefs } from './links'
import { cn } from '../../lib/utils'

/** Theme-aware Transovo lettermark (from public/icon.svg paths) plus wordmark. */
export function MarketingLogo({
  href = hrefs.home,
  className,
}: {
  href?: string
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group inline-flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        className,
      )}
    >
      <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-[0.55rem] bg-foreground text-background shadow-xs ring-1 ring-inset ring-white/15">
        <svg viewBox="0 0 180 180" className="size-[1.35rem]" aria-hidden>
          <g style={{ transform: 'scale(0.95)', transformOrigin: 'center' }}>
            <path
              fill="currentColor"
              d="M101.141 53H136.632C151.023 53 162.689 64.6662 162.689 79.0573V112.904H148.112V79.0573C148.112 78.7105 148.098 78.3662 148.072 78.0251L112.581 112.898C112.701 112.902 112.821 112.904 112.941 112.904H148.112V126.672H112.941C98.5504 126.672 86.5638 114.891 86.5638 100.5V66.7434H101.141V100.5C101.141 101.15 101.191 101.792 101.289 102.422L137.56 66.7816C137.255 66.7563 136.945 66.7434 136.632 66.7434H101.141V53Z"
            />
            <path
              fill="currentColor"
              d="M65.2926 124.136L14 66.7372H34.6355L64.7495 100.436V66.7372H80.1365V118.47C80.1365 126.278 70.4953 129.958 65.2926 124.136Z"
            />
          </g>
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[0.95rem] font-semibold tracking-tight text-foreground">Transovo</span>
        <span className="mt-0.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
          Clips
        </span>
      </span>
    </Link>
  )
}
