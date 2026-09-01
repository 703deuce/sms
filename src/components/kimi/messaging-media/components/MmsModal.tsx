'use client'

import { AlertTriangle, X } from 'lucide-react'

interface Props {
  onClose: () => void
}

export default function MmsModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-border bg-card p-7 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute right-3.5 top-3.5 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
          onClick={onClose}
        >
          <X size={16} />
        </button>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-1 ring-amber-200">
          <AlertTriangle size={22} />
        </div>
        <h2 className="mt-4 text-[15px] font-semibold tracking-tight text-foreground">
          A Heads-Up About Your Message
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Cellular carriers charge more for MMS messages than they do for standard SMS. Because of
          this, when you send a message with an attachment, the number of messages used will be
          multiplied by 3. It will, however, allow you to use up to 1,600 characters at no
          additional cost.
        </p>
        <button
          className="mt-6 inline-flex h-9 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[0.98]"
          onClick={onClose}
        >
          Got It
        </button>
      </div>
    </div>
  )
}
