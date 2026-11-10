import type { Metadata } from 'next'
import {
  ArrowRight,
  Captions,
  Clapperboard,
  FileUp,
  LayoutTemplate,
  Mic,
  Radio,
  Share2,
  Sparkles,
  Type,
} from 'lucide-react'
import { PrimaryCta, SecondaryCta, TextCta } from '../../components/marketing/cta'
import { FaqList, faqJsonLd, type FaqItem } from '../../components/marketing/faq'
import { FinalCta } from '../../components/marketing/final-cta'
import { hrefs, siteOrigin } from '../../components/marketing/links'
import { CaptionBrandMock, ClipsHeroMock, EditorHeroMock } from '../../components/marketing/mocks'
import { MarketingNav } from '../../components/marketing/nav'
import { CreditChip, Section } from '../../components/marketing/section'
import { redirectNonMarketingRoot } from '../../components/marketing/enforce-host'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Transovo Clips — AI clipping and a real video editor',
  description:
    'Turn long videos into short clips, edit by transcript, and export ready-to-post videos. Usage is measured in credits.',
  alternates: { canonical: siteOrigin },
  openGraph: {
    title: 'Transovo Clips — AI clipping and a real video editor',
    description: 'Turn long videos into short clips, edit by transcript, and export ready-to-post videos.',
    url: siteOrigin,
    siteName: 'Transovo Clips',
    type: 'website',
  },
}

const faqs: FaqItem[] = [
  {
    question: 'What is Transovo?',
    answer:
      'Transovo is an AI clipper and a real video editor in one workspace. Start with a long episode, get 30, 60, or 90 second clips with a why-this-moment reason, then finish on Script and Timeline — captions, brand kits, motion titles, and export included.',
  },
  {
    question: 'Do I need a separate editor after I clip?',
    answer:
      'No. Every AI cut lands on a real Script and Timeline in the same project. You can trim a hook, fix a caption, or keep cutting — you do not have to start over in another tool.',
  },
  {
    question: 'What can streamers import?',
    answer:
      'Upload a file, or bring a video in from Google Drive, Dropbox, YouTube, or Twitch. Streamers can also auto-pull VODs from Twitch and Kick, then cut them with the same clipper and studio.',
  },
  {
    question: 'What are AI-assisted Producer modes?',
    answer:
      'Story, multi-source Story (two to five videos), and Clean Take are available as optional assists. They can help stitch non-contiguous moments or clean false starts and filler. They are not a guarantee of a finished edit.',
  },
  {
    question: 'Can I record in Transovo?',
    answer:
      'Yes. Start a solo recording, or use remote recording Rooms when they are enabled in your workspace. Share links are available when you want a second pair of eyes before you post.',
  },
  {
    question: 'How does pricing work?',
    answer:
      'Usage is measured in credits. Log in or open Clips to see the current credit balance in your workspace. This page does not invent plan tiers.',
  },
]

const moreFeatures: {
  icon: typeof Radio
  title: string
  body: string
  href?: string
  cta?: string
}[] = [
  {
    icon: Radio,
    title: 'Twitch and Kick auto-pull',
    body: 'Bring stream VODs in automatically, then cut them into Shorts-ready clips with the same Story, layout, and caption tools.',
    href: hrefs.streamer,
    cta: 'Open Streamer',
  },
  {
    icon: Captions,
    title: 'Auto captions',
    body: 'Captions come along with the clip so you can review and tweak them before you export.',
  },
  {
    icon: LayoutTemplate,
    title: 'Brand kits',
    body: 'Apply a logo plus intro and outro bookends so exports stay on-brand.',
  },
  {
    icon: Type,
    title: 'Motion-graphics titles',
    body: 'Text layers and motion titles when a moment needs a card — then edit them on the timeline.',
  },
  {
    icon: Mic,
    title: 'Recording and Rooms',
    body: 'Start a solo recording, or open a remote Room when it is enabled in your workspace.',
    href: hrefs.rooms,
    cta: 'Open Rooms',
  },
  {
    icon: Share2,
    title: 'Share links',
    body: 'Send a review link when you want a second pair of eyes before you post. Social scheduling is not part of this launch.',
  },
  {
    icon: Sparkles,
    title: 'AI-assisted Producer modes',
    body: 'Story, multi-source Story (two to five videos), and Clean Take are optional assists — not a finished-edit promise.',
  },
  {
    icon: Clapperboard,
    title: 'Export MP4 at 720 or 1080',
    body: 'Platform aspect presets are included. 4K is not part of this launch claim.',
  },
]

export default async function HomePage() {
  await redirectNonMarketingRoot()
  const jsonLd = faqJsonLd(faqs)
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <MarketingNav current="home" />
      <main id="main">
        <section className="relative overflow-hidden px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,oklch(0.45_0.18_300_/_0.28),transparent_70%)]"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16">
            <div>
              <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-brand">Transovo Clips</p>
              <h1 className="mt-4 text-balance text-[2.35rem] font-semibold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl xl:text-7xl">
                Turn long videos into short clips — then finish them in the studio.
              </h1>
              <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                Start with the AI clipper: 30, 60, or 90 second clips built to start on the hook and avoid mid-sentence
                cuts, each with a why-this-moment reason — not a virality score. Every AI cut opens on a real Script and
                Timeline you can edit.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <PrimaryCta href={hrefs.clipsNew}>
                  Start clipping
                  <ArrowRight className="size-4" aria-hidden />
                </PrimaryCta>
                <SecondaryCta href={hrefs.editorNew}>Open the studio</SecondaryCta>
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
          id="ai-clips"
          eyebrow="AI Clips"
          title="The clipper comes first."
          description="Import a long episode, stitch a Story from non-contiguous moments, and review why each clip was chosen. Layouts include auto, speaker-follow, split, and grid."
        >
          <div className="flex flex-wrap items-center justify-center gap-3">
            <PrimaryCta href={hrefs.aiClips}>
              Explore AI Clips
              <ArrowRight className="size-4" aria-hidden />
            </PrimaryCta>
            <SecondaryCta href={hrefs.clipsNew}>Start clipping</SecondaryCta>
          </div>
        </Section>

        <Section
          tone="raised"
          id="video-editing"
          eyebrow="Video editing"
          title="Every AI cut lands on a real timeline."
          description="Script view for speed, a multi-lane timeline for control. Cut fillers and silence, put back anything cleanup got wrong, then caption, brand, and export MP4s at 720 or 1080."
        >
          <EditorHeroMock />
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <PrimaryCta href={hrefs.videoEditing}>
              Explore Video Editing
              <ArrowRight className="size-4" aria-hidden />
            </PrimaryCta>
            <SecondaryCta href={hrefs.editorNew}>Open the studio</SecondaryCta>
          </div>
        </Section>

        <Section
          id="more"
          eyebrow="Also in the workspace"
          title="Captions, brand, capture, and share — already live."
          description="Captions, brand kits, motion titles, recording Rooms, share links, and optional AI-assisted Producer modes — all in the same workspace. Social scheduling and 4K export are not part of this launch."
        >
          <CaptionBrandMock />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {moreFeatures.map((item) => (
              <article key={item.title} className="flex flex-col rounded-2xl border border-border bg-background p-5">
                <item.icon className="size-5 text-brand" aria-hidden />
                <h3 className="mt-4 font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                {item.href && item.cta ? (
                  <TextCta href={item.href} className="mt-4">
                    {item.cta}
                    <ArrowRight className="size-3.5" aria-hidden />
                  </TextCta>
                ) : null}
              </article>
            ))}
          </div>
        </Section>

        <Section tone="raised" id="how-it-works" eyebrow="How it works" title="Clip it. Finish it. Share it.">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                n: '01',
                title: 'Import a long source',
                body: 'Upload a file or paste a Drive, Dropbox, YouTube, or Twitch link — up to 10 hours or 30 GB. Streamers can auto-pull from Twitch and Kick.',
              },
              {
                n: '02',
                title: 'Get clips that start on the hook',
                body: 'The clipper is built so candidates start on the hook and are less likely to cut mid-sentence. Read the why-this-moment reason, then open the same project in the studio.',
              },
              {
                n: '03',
                title: 'Edit, caption, export',
                body: 'Trim on Script and Timeline, add captions or a brand kit, and export a ready-to-post MP4. Send a share link when you want a review.',
              },
            ].map((step) => (
              <article key={step.n} className="rounded-2xl border border-border bg-background p-6">
                <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-brand">{step.n}</p>
                <h3 className="mt-3 font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section eyebrow="FAQ" title="Questions, answered plainly.">
          <FaqList items={faqs} />
        </Section>

        <FinalCta
          title="Start clipping with credits."
          description="Open Clips to import a long episode, or go straight to the studio. Log in takes you to the app — there is no separate login page yet."
          primaryHref={hrefs.clipsNew}
          primaryLabel="Start clipping"
          secondaryHref={hrefs.app}
          secondaryLabel="Log in"
        />
      </main>
    </>
  )
}
