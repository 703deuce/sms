import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { MarketingFooter } from '../../components/marketing/footer'
import { siteOrigin } from '../../components/marketing/links'

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
}

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div data-marketing className="min-h-dvh bg-background text-foreground">
      {/*
        The app shell sets html { font-size: 80% } from 768px up for editor density.
        Restore a full typographic scale on marketing routes only.
      */}
      <style>{`@media (min-width: 768px) { html:has([data-marketing]) { font-size: 100%; } }`}</style>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow-lg"
      >
        Skip to content
      </a>
      {children}
      <MarketingFooter />
    </div>
  )
}
