/**
 * Seed 12 system T2vTemplate rows (workspaceId null). Run: npx tsx scripts/seed-t2v-templates.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SEEDS = [
  { id: 'tmpl_sys_explainer_16', name: 'Clean explainer', category: 'explainer', aspect: '16:9', tone: 'professional' },
  { id: 'tmpl_sys_listicle_916', name: 'Listicle shorts', category: 'listicle', aspect: '9:16', tone: 'energetic' },
  { id: 'tmpl_sys_promo_11', name: 'Product promo', category: 'promo', aspect: '1:1', tone: 'energetic' },
  { id: 'tmpl_sys_news_169', name: 'News desk', category: 'news', aspect: '16:9', tone: 'professional' },
  { id: 'tmpl_sys_tutorial_169', name: 'Step-by-step tutorial', category: 'tutorial', aspect: '16:9', tone: 'friendly' },
  { id: 'tmpl_sys_quote_916', name: 'Quote card', category: 'quote', aspect: '9:16', tone: 'calm' },
  { id: 'tmpl_sys_story_916', name: 'Story arc', category: 'story', aspect: '9:16', tone: 'friendly' },
  { id: 'tmpl_sys_explainer_916', name: 'Vertical explainer', category: 'explainer', aspect: '9:16', tone: 'friendly' },
  { id: 'tmpl_sys_listicle_169', name: 'Top five list', category: 'listicle', aspect: '16:9', tone: 'friendly' },
  { id: 'tmpl_sys_promo_169', name: 'Launch trailer', category: 'promo', aspect: '16:9', tone: 'professional' },
  { id: 'tmpl_sys_tutorial_11', name: 'Quick tip', category: 'tutorial', aspect: '1:1', tone: 'calm' },
  { id: 'tmpl_sys_news_916', name: 'Breaking vertical', category: 'news', aspect: '9:16', tone: 'professional' },
] as const

async function main() {
  let n = 0
  for (let i = 0; i < SEEDS.length; i++) {
    const s = SEEDS[i]
    await prisma.t2vTemplate.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        workspaceId: null,
        name: s.name,
        category: s.category,
        aspect: s.aspect,
        sortOrder: i,
        isPublished: true,
        sampleScript: 'Hook your audience in the first five seconds. End with a clear call to action.',
        settings: {
          description: `${s.name} — style preset only; your script stays unchanged.`,
          settings: {
            aspect: s.aspect,
            tone: s.tone,
            platform: s.aspect === '9:16' ? 'tiktok' : 'youtube',
            mediaSources: ['pixabay'],
            captionsEnabled: true,
          },
          music: { volume: 0.22, duck: true },
          defaultTransitions: { transition: 'fade', transitionMs: 500 },
        },
      },
      update: {
        name: s.name,
        category: s.category,
        aspect: s.aspect,
        sortOrder: i,
        isPublished: true,
      },
    })
    n++
  }
  console.log(`Upserted ${n} system templates`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
