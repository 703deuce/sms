'use client'

import { useEffect, useState } from 'react'
import type { VideoTemplateRelease } from '@/lib/clips/real-video-templates/gallery'
import { aspectCss } from '@/lib/clips/export-aspect'

export function galleryCardAspectStyle(aspect: string) {
  if (aspect === '9:16') return { className: 'aspect-[9/16] max-h-[420px] w-full mx-auto', ratio: aspectCss('9:16') }
  if (aspect === '1:1') return { className: 'aspect-square w-full', ratio: aspectCss('1:1') }
  return { className: 'aspect-video w-full', ratio: aspectCss('16:9') }
}

export function AnimatedTemplateCardPreview({ item }: { item: VideoTemplateRelease }) {
  const [active, setActive] = useState(0)
  const slots = item.family.slots
  const slot = slots[active] ?? slots[0]
  const accent = item.previewStyle?.accent ?? '#FACC15'
  const foreground = item.previewStyle?.foreground ?? '#FFFFFF'
  const closing = active === slots.length - 1
  const text = closing ? item.family.texts[1] : item.family.texts[0]
  const frame = galleryCardAspectStyle(item.family.aspects[0] ?? '16:9')
  useEffect(() => {
    if (slots.length < 2) return
    const ms = Math.max(650, Math.min(1300, Math.round((slot?.durationFrames ?? 30) * 15)))
    const timer = window.setTimeout(() => setActive(index => (index + 1) % slots.length), ms)
    return () => window.clearTimeout(timer)
  }, [active, item.id, slot?.durationFrames, slots.length])
  const shift = (active % 3 - 1) * 5
  return (
    <div className={'relative overflow-hidden bg-neutral-950 ' + frame.className} style={{ aspectRatio: frame.ratio }}
      aria-label={'Animated preview ' + item.title}>
      <div className="absolute inset-0 opacity-90" style={{
        background: 'radial-gradient(circle at 18% 20%,' + accent + '30,transparent 34%),linear-gradient(135deg,#09090b,#18181b 58%,#020617)',
      }} />
      <MotionFrame slots={slots} active={active} accent={accent} foreground={foreground} text={text} item={item} shift={shift} />
      <span className="absolute left-3 top-3 rounded-full border border-amber-300/40 bg-amber-300/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-200">
        {item.certificationStatus === 'certified' ? 'Certified' : 'Preview'}
      </span>
    </div>
  )
}

function MotionFrame({ slots, active, accent, foreground, text, item, shift }: {
  slots: VideoTemplateRelease['family']['slots']
  active: number
  accent: string
  foreground: string
  text: VideoTemplateRelease['family']['texts'][number] | undefined
  item: VideoTemplateRelease
  shift: number
}) {
  const innerAspect = item.family.aspects[0] === '9:16' ? 'aspect-[9/16]' : item.family.aspects[0] === '1:1' ? 'aspect-square' : 'aspect-video'
  return (
    <div className={'absolute left-1/2 top-1/2 h-[92%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-white/15 bg-black shadow-2xl ' + innerAspect}>
      <div className="absolute -inset-3 transition-all duration-500 ease-out" style={{
        background: 'linear-gradient(' + (125 + active * 31) + 'deg,' + accent + '66 0%,#111827 42%,#020617 100%)',
        transform: 'translate3d(' + shift + '%,0,0) scale(' + (1.03 + active * 0.008) + ')',
      }} />
      <div className="absolute inset-0 opacity-70" style={{
        background: 'linear-gradient(to bottom,transparent 35%,rgba(0,0,0,.18) 58%,rgba(0,0,0,.78) 100%)',
      }} />
      <div className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/35 px-2 py-1 text-[9px] font-semibold text-white/85">
        {String(active + 1).padStart(2, '0')} / {String(slots.length).padStart(2, '0')}
      </div>
      <div className="absolute inset-x-4 transition-all duration-500" style={{ top: (text?.y ?? 24) + '%', transform: 'translateY(-50%)' }}>
        <div className="text-center font-semibold leading-[.94] tracking-tight drop-shadow-lg" style={{
          color: foreground,
          fontFamily: text?.font ?? item.previewStyle?.headingFont,
          fontSize: Math.max(15, Math.min(28, (text?.size ?? 60) / 2.5)),
        }}>
          {text?.defaultText ?? item.title}
        </div>
      </div>
      <div className="absolute inset-x-3 bottom-4 flex gap-1">
        {slots.map((itemSlot, index) => (
          <span key={itemSlot.id} className={'h-1 rounded-full transition-opacity ' + (index === active ? 'bg-white' : 'bg-white/25')}
            style={{ flexGrow: itemSlot.durationFrames }} />
        ))}
      </div>
    </div>
  )
}

export function RenderedTemplateCardPreview({ item, forcePlay }: { item: VideoTemplateRelease; forcePlay?: boolean }) {
  const media = item.previewMedia
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(Boolean(forcePlay))
  const [failed, setFailed] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const frameStyle = galleryCardAspectStyle(item.family.aspects[0] ?? '16:9')

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
  useEffect(() => {
    if (!media) return
    setFailed(false)
    const image = new window.Image()
    image.onerror = () => setFailed(true)
    image.src = media.spritePath
    return () => { image.onerror = null }
  }, [media])
  useEffect(() => {
    if (!playing || reducedMotion || failed || !media) return
    const slot = item.family.slots[frame % Math.max(1, item.family.slots.length)]
    const ms = Math.max(420, Math.min(900, Math.round((slot?.durationFrames ?? 45) * 10)))
    const timer = window.setTimeout(() => setFrame(value => (value + 1) % media.frames), ms)
    return () => window.clearTimeout(timer)
  }, [failed, frame, item.family.slots, media, playing, reducedMotion])

  if (!media || failed) return <AnimatedTemplateCardPreview item={item} />
  const seconds = (item.family.totalFrames / item.family.fps).toFixed(1).replace(/\.0$/, '')
  return (
    <div
      className={'group relative overflow-hidden bg-black ' + frameStyle.className}
      style={{ aspectRatio: frameStyle.ratio }}
      aria-label={'Rendered preview ' + item.title}
      onMouseEnter={() => setPlaying(true)}
      onMouseLeave={() => { if (!forcePlay) { setPlaying(false); setFrame(0) } }}
    >
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={media.spritePath}
          alt=""
          aria-hidden
          className="pointer-events-none h-full max-w-none select-none"
          style={{
            width: (media.columns * 100) + '%',
            transform: 'translateX(-' + ((frame % media.columns) * (100 / media.columns)) + '%)',
          }}
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/15" />
      <span className="absolute left-3 top-3 rounded-full border border-amber-300/40 bg-black/50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-100">
        {item.certificationStatus === 'certified' ? 'Certified' : 'Preview'}
      </span>
      <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2 py-1 text-[10px] font-medium text-white">
        {seconds}s · {item.family.slots.length} clips
      </span>
      {!reducedMotion ? (
        <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2 py-1 text-[10px] font-medium text-white/90">
          {playing ? 'Previewing' : 'Hover preview'}
        </span>
      ) : null}
    </div>
  )
}
