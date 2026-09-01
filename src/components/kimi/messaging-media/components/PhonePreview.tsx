'use client'

import { MessageSquare } from 'lucide-react'

interface Props {
  message: string
  attachment: { name: string; color: string; label: string } | null
  label?: string
}

export default function PhonePreview({ message, attachment, label = 'Message Preview' }: Props) {
  const isEmpty = !message && !attachment

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-4 flex justify-center">
        <div className="w-[240px] rounded-[2rem] border border-border bg-muted/40 p-2 shadow-inner">
          <div className="relative overflow-hidden rounded-[1.6rem] bg-background">
            {/* Notch */}
            <div className="relative flex h-7 items-start justify-center">
              <div className="h-5 w-24 rounded-b-2xl bg-foreground/90" />
            </div>
            {/* Screen */}
            <div className="flex min-h-[300px] flex-col gap-2 px-3 pb-5 pt-1">
              {isEmpty ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <MessageSquare size={15} />
                  </div>
                  <p className="px-4 text-[11px] leading-relaxed text-muted-foreground">
                    Your message will appear here
                  </p>
                </div>
              ) : (
                <>
                  {message ? (
                    <div className="max-w-[85%] self-start whitespace-pre-wrap break-words rounded-2xl rounded-bl-md bg-primary px-3 py-2 text-left text-[11.5px] leading-relaxed text-primary-foreground shadow-sm">
                      {message}
                    </div>
                  ) : null}
                  {attachment ? (
                    <div
                      className="relative mt-0.5 w-full overflow-hidden rounded-2xl rounded-bl-md shadow-sm"
                      style={{ background: attachment.color }}
                    >
                      <div className="flex flex-col gap-0.5 px-3 pt-2.5 opacity-20">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <span
                            key={i}
                            className="whitespace-nowrap text-[9px] font-bold tracking-widest text-white"
                          >
                            {attachment.label} {attachment.label} {attachment.label}
                          </span>
                        ))}
                      </div>
                      <div className="py-3 text-center text-4xl">👕</div>
                      <div className="bg-black/30 py-2 text-center text-[10px] font-bold tracking-widest text-white">
                        20% OFF BASICS
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
            {/* Home indicator */}
            <div className="flex justify-center pb-2">
              <div className="h-1 w-20 rounded-full bg-foreground/20" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
