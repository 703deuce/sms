import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { isCurrentRequestMarketingHost } from '../../components/marketing/enforce-host'
import { MarketingFooter } from '../../components/marketing/footer'
import { siteOrigin } from '../../components/marketing/links'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  if (!(await isCurrentRequestMarketingHost())) return {}
  return { metadataBase: new URL(siteOrigin) }
}

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  // On voice / other app hosts, do not wrap the response in marketing chrome.
  // The page itself redirects `/` to /app/home or 404s the marketing subpaths.
  if (!(await isCurrentRequestMarketingHost())) {
    return children
  }

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
