import type { Metadata } from 'next'
import {
  ArrowRight,
  Captions,
  Clapperboard,
  Layers,
  LayoutTemplate,
  Mic,
  Share2,
  Sparkles,
  Type,
  Wand2,
} from 'lucide-react'
import { PrimaryCta, SecondaryCta, TextCta } from '../../../components/marketing/cta'
import { FaqList, faqJsonLd, type FaqItem } from '../../../components/marketing/faq'
import { FinalCta } from '../../../components/marketing/final-cta'
import { hrefs, siteOrigin } from '../../../components/marketing/links'
import { CaptionBrandMock, EditorHeroMock } from '../../../components/marketing/mocks'
import { MarketingNav } from '../../../components/marketing/nav'
import { CreditChip, Section } from '../../../components/marketing/section'

const title = 'Video Editing'
const description =
  'Edit by transcript, finish on a real timeline. Cut fillers and silence in Script view, refine on a multi-lane timeline, brand the piece, and export ready-to-post MP4s.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${siteOrigin}/video-editing` },
  openGraph: {
    title: 'Video Editing · Transovo Clips',
    description,
    url: `${siteOrigin}/video-editing`,
    siteName: 'Transovo Clips',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Video Editing · Transovo Clips',
    description,
  },
}

const faqs: FaqItem[] = [
  {
    question: 'What can I open in the studio?',
    answer:
      'Open a short clip, a longer video, or start a blank project. Clip editing and full-video editing share the same Script and Timeline views.',
  },
  {
    question: 'Can I edit by deleting words in the transcript?',
    answer:
      'Yes. Script view supports cuts, filler removal, silence shortening, find and replace, and undo/redo. Use the timeline when you need frame-level control.',
  },
  {
    question: 'What export formats are available?',
    answer:
      'Export MP4 at 720 or 1080, with platform aspect presets. 4K and audio-only export are not claimed here.',
  },
  {
    question: 'Do you match every CapCut or Descript feature?',
    answer:
      'No. The studio covers transcript editing, a multi-lane timeline, captions, brand kits, motion titles, and 720/1080 export. It is not a full parity claim against those tools.',
  },
  {
    question: 'What are AI-assisted Producer modes?',
    answer:
      'Story, multi-source Story (two to five videos), and Clean Take are available as optional assists. They can help assemble a cut or clean false starts and filler — they are not a guarantee of a finished edit.',
  },
  {
    question: 'How does pricing work?',
    answer:
      'Usage is measured in credits. Open the studio to see the current credit balance in your workspace. This page does not invent plan tiers.',
  },
]

export default function VideoEditingPage() {
  const jsonLd = faqJsonLd(faqs)
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <MarketingNav current="video-editing" />
      <main id="main">
        <section className="relative overflow-hidden px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,oklch(0.45_0.18_300_/_0.28),transparent_70%)]"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
            <div>
              <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-brand">Video editing</p>
              <h1 className="mt-4 text-balance text-[2.35rem] font-semibold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl xl:text-7xl">
                Script view for speed. Timeline for control.
              </h1>
              <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                Every AI cut lands on a real Script and Timeline you can trim, caption, and export. Cut fillers and silence in Script view, put back anything it got wrong, and export ready-to-post MP4s at 720 or 1080.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <PrimaryCta href={hrefs.editorNew}>
                  Open the studio
                  <ArrowRight className="size-4" aria-hidden />
                </PrimaryCta>
                <SecondaryCta href="#script">See the workflow</SecondaryCta>
              </div>
            </div>
            <EditorHeroMock />
          </div>
        </section>

        <div className="border-y border-border bg-card/30">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-3 px-5 py-5 text-sm text-muted-foreground sm:px-8">
            <CreditChip>Script + Timeline</CreditChip>
            <span>Animated captions</span>
            <span>Brand kits</span>
            <span>MP4 720 / 1080</span>
          </div>
        </div>

        <Section
          id="script"
          eyebrow="Script workflow"
          title="Edit the words. The picture follows."
          description="Cut a line, drop filler, shorten a pause, or find and replace a phrase. Undo and redo let you put back anything the cleanup got wrong. Then hand the same project to the timeline."
        >
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              'Cuts on the transcript',
              'Filler removal',
              'Silence shortening',
              'Find and replace',
              'Undo and redo',
              'Script + Timeline in one studio',
            ].map((item) => (
              <li key={item} className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground">
                {item}
              </li>
            ))}
          </ul>
        </Section>

        <Section
          tone="raised"
          eyebrow="Timeline studio"
          title="A real multi-lane timeline, not a preview."
          description="Trim, split, and join clips. Snap, zoom, and read waveforms. Animate with keyframes, change speed, and choose from about 14 transitions."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              'Multi-lane timeline',
              'Trim, split, join',
              'Snapping and zoom',
              'Waveforms',
              'Keyframes',
              'Speed',
              'About 14 transitions',
              '720 and 1080 export',
            ].map((item) => (
              <p key={item} className="rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground">
                {item}
              </p>
            ))}
          </div>
        </Section>

        <Section
          eyebrow="Polish"
          title="Captions, brand kits, and motion titles."
          description="Animated caption presets, text layers, motion-graphics titles, and brand kits with logo plus intro and outro bookends. Stock B-roll, effects, filters, and looks are in the studio too."
        >
          <CaptionBrandMock />
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Captions, title: 'Animated captions', body: 'Presets and animations you can apply, then tweak.' },
              { icon: LayoutTemplate, title: 'Brand kits and templates', body: 'Logo, intro, and outro bookends on the edit.' },
              { icon: Type, title: 'Motion-graphics titles', body: 'Text layers and titles when a moment needs a card.' },
            ].map((item) => (
              <article key={item.title} className="rounded-2xl border border-border bg-card p-5">
                <item.icon className="size-5 text-brand" aria-hidden />
                <h3 className="mt-3 font-semibold text-foreground">{item.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section
          tone="raised"
          eyebrow="Capture"
          title="Record solo, or open a remote Room."
          description="Start a solo recording, or use remote recording Rooms when they are enabled in your workspace."
        >
          <div className="flex justify-center">
            <PrimaryCta href={hrefs.editorNew}>
              <Mic className="size-4" aria-hidden />
              Open the studio
            </PrimaryCta>
          </div>
        </Section>

        <Section
          eyebrow="Export and share"
          title="Ready-to-post MP4s, in the aspect you need."
        >
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Layers,
                title: 'Multi-aspect layouts',
                body: 'Frame the edit for the destination, then export the version you need.',
              },
              {
                icon: Clapperboard,
                title: 'MP4 at 720 or 1080',
                body: 'Platform presets are included. 4K is not part of this launch claim.',
              },
              {
                icon: Share2,
                title: 'Share links',
                body: 'Send a review link when you want a second pair of eyes before you post.',
              },
            ].map((item) => (
              <article key={item.title} className="rounded-2xl border border-border bg-card p-6">
                <item.icon className="size-5 text-brand" aria-hidden />
                <h3 className="mt-4 text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section
          tone="raised"
          eyebrow="AI-assisted"
          title="Optional helps, not a finished-edit promise."
          description="Producer modes can assist a cut. They do not guarantee a particular outcome, a viral score, or a perfect cleanup."
        >
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Sparkles,
                title: 'Story',
                body: 'An AI-assisted pass that can stitch moments from a single video into one edit.',
              },
              {
                icon: Wand2,
                title: 'Multi-source Story',
                body: 'Combine two to five videos into one AI-assisted edit when the story spans sources.',
              },
              {
                icon: Wand2,
                title: 'Clean Take',
                body: 'An AI-assisted cleanup for false starts and filler in a raw talking take.',
              },
            ].map((item) => (
              <article key={item.title} className="rounded-2xl border border-border bg-background p-6">
                <item.icon className="size-5 text-brand" aria-hidden />
                <h3 className="mt-4 font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section eyebrow="Start from AI Clips" title="Find the short. Finish it here.">
          <p className="mx-auto mb-8 max-w-2xl text-center text-muted-foreground">
            Use AI Clips to pull a Story from a long episode. Every AI cut lands on this same timeline, so you extend a hook, fix a caption, and export without starting over.
          </p>
          <div className="flex justify-center">
            <TextCta href={hrefs.aiClips}>
              See the AI Clips page
              <ArrowRight className="size-4" aria-hidden />
            </TextCta>
          </div>
        </Section>

        <Section eyebrow="FAQ" title="Questions, answered plainly.">
          <FaqList items={faqs} />
        </Section>

        <FinalCta
          title="Open the studio with credits."
          description="Start a full-video project, cut on the transcript, and export an MP4 when the timeline is right."
          primaryHref={hrefs.editorNew}
          primaryLabel="Open the studio"
          secondaryHref={hrefs.clips}
          secondaryLabel="Open Clips"
        />
      </main>
    </>
  )
}
