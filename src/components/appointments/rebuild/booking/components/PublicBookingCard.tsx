"use client";

import {
  CalendarClock,
  Globe,
  ExternalLink,
  Copy,
  Link2,
  Mail,
  Facebook,
  Twitter,
  MoreHorizontal,
  Check,
} from "lucide-react";
import Link from "next/link";

export default function PublicBookingCard({
  bookingEnabled,
  bookingUrl,
  previewHref,
  hasSlug,
  saving,
  copied,
  onToggle,
  onCopy,
}: {
  bookingEnabled: boolean;
  bookingUrl: string;
  previewHref: string;
  hasSlug: boolean;
  saving: boolean;
  copied: boolean;
  onToggle: (next: boolean) => void;
  onCopy: () => void;
}) {
  return (
    <div className="booking-card">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="card-icon">
            <CalendarClock className="h-4 w-4" strokeWidth={1.9} />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">
              Public booking page
            </h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              {bookingEnabled
                ? "Your booking page is live. Customers can book using your public link."
                : "Allow customers to book appointments through your public booking page."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-[12.5px] font-medium text-muted-foreground">
            {bookingEnabled ? "Enabled" : "Enable"}
          </span>
          <button
            className="toggle"
            data-on={bookingEnabled}
            disabled={saving || !hasSlug}
            onClick={() => onToggle(!bookingEnabled)}
            aria-label="Toggle public booking page"
            type="button"
          />
        </div>
      </div>

      {hasSlug ? (
        <>
          <div className="mt-5">
            <label className="field-label">Public booking URL</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Globe
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  strokeWidth={1.8}
                />
                <input className="field-input pl-9" value={bookingUrl} readOnly />
              </div>
              {bookingEnabled ? (
                <Link href={previewHref} target="_blank" className="btn-outline">
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.9} />
                  Open
                </Link>
              ) : null}
              <button className="btn-outline" type="button" onClick={onCopy}>
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={1.9} />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" strokeWidth={1.9} />
                    Copy link
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mt-5">
            <label className="field-label">Share your booking page</label>
            <p className="mb-2.5 text-[12px] text-muted-foreground">
              Promote your booking page across channels.
            </p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-outline" type="button" onClick={onCopy}>
                <Link2 className="h-3.5 w-3.5" strokeWidth={1.9} />
                Copy link
              </button>
              <a
                className="btn-outline"
                href={bookingUrl ? `mailto:?subject=Book%20an%20appointment&body=${encodeURIComponent(bookingUrl)}` : undefined}
              >
                <Mail className="h-3.5 w-3.5" strokeWidth={1.9} />
                Email
              </a>
              <a
                className="btn-outline"
                href={
                  bookingUrl
                    ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(bookingUrl)}`
                    : undefined
                }
                target="_blank"
                rel="noreferrer"
              >
                <Facebook className="h-3.5 w-3.5 text-[#1877f2]" strokeWidth={1.9} />
                Facebook
              </a>
              <a
                className="btn-outline"
                href={
                  bookingUrl
                    ? `https://twitter.com/intent/tweet?url=${encodeURIComponent(bookingUrl)}`
                    : undefined
                }
                target="_blank"
                rel="noreferrer"
              >
                <Twitter className="h-3.5 w-3.5" strokeWidth={1.9} />
                X (Twitter)
              </a>
              <button className="btn-outline" type="button" onClick={onCopy}>
                <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.9} />
                More
              </button>
            </div>
          </div>
        </>
      ) : (
        <p className="mt-5 text-[12.5px] leading-relaxed text-amber-800">
          Set a workspace slug in Settings before sharing a booking link.
        </p>
      )}
    </div>
  );
}
