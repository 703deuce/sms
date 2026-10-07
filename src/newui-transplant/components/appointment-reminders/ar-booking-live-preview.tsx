'use client'

import { useState } from 'react'
import {
  Calendar,
  ChevronRight,
  Clock,
  MapPin,
  MessageSquare,
  Monitor,
  Phone,
  ShieldCheck,
  Smartphone,
} from 'lucide-react'
import { OPUS_CONFIG_INSET } from '@/newui-transplant/components/app/opus-surfaces'
import { Button } from '@/newui-transplant/components/ui/button'
import { cn } from '@/lib/utils'
import type { BookingPageModel } from '@/features/appointments/kimi/booking/types'

const whyIcons: Record<string, React.ReactNode> = {
  clock: <Clock className="h-3 w-3" />,
  shield: <ShieldCheck className="h-3 w-3" />,
  message: <MessageSquare className="h-3 w-3" />,
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

type Props = {
  businessInfo: BookingPageModel['businessInfo']
  appointmentTypes: BookingPageModel['appointmentTypes']
  whyBookItems: BookingPageModel['whyBookItems']
  smsConsent: BookingPageModel['smsConsent']
}

export function ArBookingLivePreview({
  businessInfo,
  appointmentTypes,
  whyBookItems,
  smsConsent,
}: Props) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const types = appointmentTypes.length
    ? appointmentTypes
    : [
        {
          id: 'placeholder',
          name: 'Consultation',
          duration: '30 min',
          description: 'Create a service or meeting (buttons on this page) to see real types here.',
        },
      ]

  return (
    <div className={cn(OPUS_CONFIG_INSET, 'overflow-hidden')}>
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
        <span className="text-sm font-medium">Live preview</span>
        <div className="flex gap-1 rounded-lg border bg-background p-0.5">
          <Button
            type="button"
            variant={device === 'desktop' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setDevice('desktop')}
            aria-label="Desktop preview"
          >
            <Monitor className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={device === 'mobile' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setDevice('mobile')}
            aria-label="Mobile preview"
          >
            <Smartphone className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        className="bg-muted/20 p-4"
        style={device === 'mobile' ? { maxWidth: 320, margin: '0 auto' } : undefined}
      >
        <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
          <div className="h-20 bg-gradient-to-br from-primary/15 to-primary/5" />
          <div className="-mt-8 px-4 pb-4">
            <div
              className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border-4 border-background bg-primary/10 text-sm font-semibold text-primary"
              aria-hidden
            >
              {initials(businessInfo.displayName)}
            </div>
            <h3 className="text-base font-semibold">{businessInfo.displayName}</h3>
            <div className="mt-1 flex flex-col gap-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" /> {businessInfo.phone || '—'}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {businessInfo.address || '—'}
              </span>
            </div>

            <p className="mb-2 mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Select appointment type
            </p>
            <ul className="space-y-2">
              {types.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        {t.name}
                      </div>
                      <p className="text-xs text-muted-foreground">{t.duration}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>

            <p className="mb-2 mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Why book with us?
            </p>
            <div className="grid grid-cols-3 gap-2">
              {whyBookItems.map((w) => (
                <div key={w.title} className="rounded-lg border bg-muted/20 p-2 text-center">
                  <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-background text-primary">
                    {whyIcons[w.icon]}
                  </div>
                  <p className="text-[11px] font-medium leading-tight">{w.title}</p>
                  <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{w.text}</p>
                </div>
              ))}
            </div>

            <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">
              By booking, you agree to our{' '}
              <a href={smsConsent.termsUrl} className="underline underline-offset-2">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href={smsConsent.privacyUrl} className="underline underline-offset-2">
                Privacy Policy
              </a>
              . {smsConsent.wording}
            </p>
          </div>
        </div>
      </div>
      <p className="border-t px-4 py-3 text-center text-xs text-muted-foreground">
        Preview approximates your customer booking page. Payments and intake follow each appointment type.
      </p>
    </div>
  )
}
