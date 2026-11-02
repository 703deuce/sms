import { TemplatesHub } from '@/components/clips/templates/templates-hub'
import { isT2vFeatureEnabled } from '@/lib/features/t2v'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Templates · Clips' }

type Tab = 'layouts' | 'captions' | 'looks' | 'brand' | 'ai-video'

export default async function ClipsTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; sub?: string; returnTo?: string }>
}) {
  const sp = await searchParams
  const tab = (['layouts', 'captions', 'looks', 'brand', 'ai-video'] as Tab[]).includes(sp.tab as Tab)
    ? (sp.tab as Tab)
    : 'layouts'
  const sub = sp.sub === 'mine' ? 'mine' : ''
  return (
    <TemplatesHub
      key={`${tab}:${sub}`}
      initialTab={tab}
      sub={sp.sub === 'mine' ? 'mine' : undefined}
      returnTo={sp.returnTo}
      aiVideo={isT2vFeatureEnabled()}
    />
  )
}
