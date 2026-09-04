"use client";

import React from "react";
import Link from "next/link";
import { Copy, ExternalLink } from "lucide-react";

export default function BookingLinkCard({
  bookingUrl,
  previewHref,
  hasSlug,
}: {
  bookingUrl: string;
  previewHref: string;
  hasSlug: boolean;
}) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    if (!bookingUrl) return;
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="card">
      <h3 className="card__title">Your booking link</h3>
      <p className="card__sub">Share this link to allow customers to book with you.</p>

      {hasSlug ? (
        <>
          <div className="booking-link">
            <span className="booking-link__url">{bookingUrl}</span>
            <button className="booking-link__copy" onClick={copy} aria-label="Copy link" type="button">
              {copied ? <span className="booking-link__copied">✓</span> : <Copy size={15} />}
            </button>
          </div>

          <Link href={previewHref} target="_blank" className="booking-link__preview">
            Preview booking page <ExternalLink size={14} />
          </Link>
        </>
      ) : (
        <p className="card__sub">
          Set a workspace slug in Settings before sharing a booking link.
        </p>
      )}
    </div>
  );
}
