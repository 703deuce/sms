import type { Metadata } from 'next'
import {
  ArrowRight,
  Captions,
  FileUp,
  Headphones,
  Image as ImageIcon,
  Import,
  Layers,
  Radio,
  Scissors,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { PrimaryCta, SecondaryCta, TextCta } from '../../../components/marketing/cta'
import { FaqList, faqJsonLd, type FaqItem } from '../../../components/marketing/faq'
import { FinalCta } from '../../../components/marketing/final-cta'
import { hrefs, siteOrigin } from '../../../components/marketing/links'
import { ClipsHeroMock, LayoutsMock } from '../../../components/marketing/mocks'
import { notFoundUnlessMarketingHost } from '../../../components/marketing/enforce-host'
import { MarketingNav } from '../../../components/marketing/nav'
import { CreditChip, Section } from '../../../components/marketing/section'

const title = 'AI Clips'
const description =
  'Turn long episodes into short clips that still make sense. Import long-form video, stitch non-contiguous moments into a Story, and export ready-to-post 9:16 clips.'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${siteOrigin}/ai-clips` },
  openGraph: {
    title: 'AI Clips · Transovo Clips',
    description,
    url: `${siteOrigin}/ai-clips`,
    siteName: 'Transovo Clips',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'AI Clips · Transovo Clips',
    description,
  },
}

const faqs: FaqItem[] = [
  {
    question: 'How long can a clip be?',
    answer:
      'You can aim for 15, 30, 60, or 90 seconds, or let the clipper pick a length up to 90 seconds. Story mode can stitch moments from across a longer episode into one of those lengths.',
  },
  {
    question: 'What sources can I import?',
    answer:
      'Upload a file, or bring a video in from Google Drive, Dropbox, YouTube, or Twitch. Streamers can also auto-pull from Twitch and Kick.',
  },
  {
    question: 'How large can an upload be?',
    answer:
      'The clipper is built for long-form media, with a product cap of 10 hours or 30 GB per upload (the effective limit follows the storage path in your workspace).',
  },
  {
    question: 'What is Story mode?',
    answer:
      'Story stitches non-contiguous moments from a single episode into one clip, so a setup and a later payoff can live in the same short. It is a clip mode, not a promise about how many clips you will get or how they will perform.',
  },
  {
    question: 'Do you post or schedule to social platforms?',
    answer:
      'Not yet. You review, caption, and export from Transovo, then post with the tools you already use. Share links are available from the studio.',
  },
  {
    question: 'How does pricing work?',
    answer:
      'Usage is measured in credits. Open Clips to see the current credit balance in your workspace. This page does not invent plan tiers.',
  },
]

const features = [
  {
    icon: Import,
    title: 'Import from anywhere you already work',
    body: 'Upload a file, or pull from Drive, Dropbox, YouTube, or Twitch.',
  },
  {
    icon: Layers,
    title: 'Speaker-aware 9:16 layouts',
    body: 'Choose auto, speaker-follow, split, or grid when you review a clip.',
  },
  {
    icon: Captions,
    title: 'Auto captions',
    body: 'Captions come along with the clip so you can review them before you export.',
  },
  {
    icon: ImageIcon,
    title: 'AI B-roll and covers',
    body: 'Add AI-assisted B-roll and covers as you polish a clip in the studio.',
  },
  {
    icon: Headphones,
    title: 'Studio Sound',
    body: 'Clean up the voice track with Studio Sound before you ship the file.',
  },
  {
    icon: Radio,
    title: 'Twitch and Kick auto-pull',
    body: 'Bring stream VODs in automatically, then cut them into Shorts-ready clips.',
  },
]

const steps = [
  {
    n: '01',
    title: 'Import',
    body: 'Upload a long episode or paste a Drive, Dropbox, YouTube, or Twitch link — up to 10 hours or 30 GB.',
  },
  {
    n: '02',
    title: 'AI finds and stitches',
    body: 'Get moments, or a Story that joins non-contiguous passages into one 30, 60, or 90 second clip.',
  },
  {
    n: '03',
    title: 'Review, caption, export',
    body: 'Read the why-this-moment reason, check that the clip starts on the hook, then caption and finish it on a real timeline.',
  },
]

export default async function AiClipsPage() {
  await notFoundUnlessMarketingHost()
  const jsonLd = faqJsonLd(faqs)
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <MarketingNav current="ai-clips" />
      <main id="main">
        <section className="relative overflow-hidden px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,oklch(0.45_0.18_300_/_0.28),transparent_70%)]"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16">
            <div>
              <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-brand">AI Clips</p>
              <h1 className="mt-4 text-balance text-[2.35rem] font-semibold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl xl:text-7xl">
                Turn long episodes into short clips that still make sense.
              </h1>
              <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                Import a long-form source and get 30, 60, or 90 second clips built to start on the hook and avoid mid-sentence cuts. Each one includes a why-this-moment reason — not a virality score — and opens on a real timeline you can edit.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <PrimaryCta href={hrefs.clipsNew}>
                  Start clipping
                  <ArrowRight className="size-4" aria-hidden />
                </PrimaryCta>
                <SecondaryCta href="#how-it-works">Watch how it works</SecondaryCta>
              </div>
              <a
                href={hrefs.clipsNew}
                className="mt-6 flex w-full max-w-xl items-center gap-3 rounded-2xl border border-border bg-card/80 px-4 py-3 text-left shadow-xs outline-none transition-colors hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
                  <FileUp className="size-4" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-medium text-foreground">Drop a file or paste a link</span>
                  <span className="block text-xs text-muted-foreground">
                    Upload, Drive, Dropbox, YouTube, or Twitch — opens in Clips
                  </span>
                </span>
              </a>
            </div>
            <ClipsHeroMock />
          </div>
        </section>

        <div className="border-y border-border bg-card/30">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-5 py-5 sm:px-8">
            <CreditChip>Credits-based</CreditChip>
            <p className="text-sm text-muted-foreground">Built for long uploads — up to 10 hours or 30 GB</p>
            <p className="text-sm text-muted-foreground">Every AI cut opens on a real timeline</p>
          </div>
        </div>

        <Section
          eyebrow="Why Transovo"
          title="Story, not just isolated moments."
          description="A good short often needs a hook from minute two and a payoff from minute forty. Story mode stitches those passages into one clip, with a why-this-moment reason and a pass for openings and endings."
        >
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Sparkles,
                title: 'Story stitch',
                body: 'Join non-contiguous moments from a single episode into one short, instead of leaving the thread in separate clips.',
              },
              {
                icon: Scissors,
                title: 'Why this moment',
                body: 'Each clip can include a short, plain-language reason for why this moment made the cut — not a stamped virality score.',
              },
              {
                icon: ShieldCheck,
                title: 'Start on the hook',
                body: 'The clipper is built so candidates start on the hook and are less likely to cut mid-sentence, with a pass for broken openings and endings before you export.',
              },
            ].map((item) => (
              <article key={item.title} className="rounded-2xl border border-border bg-card p-6 shadow-xs">
                <item.icon className="size-5 text-brand" aria-hidden />
                <h3 className="mt-4 text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section
          id="how-it-works"
          tone="raised"
          eyebrow="How it works"
          title="Import, stitch, then finish in review."
        >
          <ol className="grid gap-4 md:grid-cols-3">
            {steps.map((step) => (
              <li key={step.n} className="rounded-2xl border border-border bg-background p-6">
                <p className="font-mono text-[0.7rem] text-brand">{step.n}</p>
                <h3 className="mt-3 text-xl font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section
          eyebrow="Layouts"
          title="Speaker-aware framing, not a single crop."
          description="Speaker-follow, split, grid, and auto layouts are ready when you review a talking-head or multi-speaker clip. You choose the layout that fits the moment."
        >
          <LayoutsMock />
        </Section>

        <Section tone="raised" eyebrow="Features" title="Everything you need to go from source to export.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((item) => (
              <article key={item.title} className="rounded-2xl border border-border bg-background p-6">
                <item.icon className="size-5 text-brand" aria-hidden />
                <h3 className="mt-4 font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section
          eyebrow="For streamers"
          title="VOD to Shorts, without leaving the clipper."
          description="Auto-pull from Twitch and Kick, then cut a VOD into vertical clips with the same Story, layout, and caption tools."
        >
          <div className="flex flex-wrap items-center justify-center gap-3">
            <PrimaryCta href={hrefs.streamer}>
              Open Streamer
              <ArrowRight className="size-4" aria-hidden />
            </PrimaryCta>
            <SecondaryCta href={hrefs.clipsNew}>Start from a VOD link</SecondaryCta>
          </div>
        </Section>

        <Section tone="raised" eyebrow="Then finish in the studio" title="Every AI cut lands on a real timeline.">
          <p className="mx-auto mb-8 max-w-2xl text-center text-muted-foreground">
            Story, moments, and other AI-assisted cuts open in Script and Timeline, so a too-short hook is a trim — not a rebuild in another editor. Same project, same credits.
          </p>
          <div className="flex justify-center">
            <TextCta href={hrefs.videoEditing}>
              See the video editing page
              <ArrowRight className="size-4" aria-hidden />
            </TextCta>
          </div>
        </Section>

        <Section eyebrow="FAQ" title="Questions, answered plainly.">
          <FaqList items={faqs} />
        </Section>

        <FinalCta
          title="Start clipping with credits."
          description="Open a new project, drop a long episode or a link, and review the first Story in the studio."
          primaryHref={hrefs.clipsNew}
          primaryLabel="Start clipping"
          secondaryHref={hrefs.clips}
          secondaryLabel="Open Clips"
        />
      </main>
    </>
  )
}
