"use client";

import React from "react";
import { Globe, Copy, Check, ExternalLink } from "lucide-react";

type Props = {
  enabled: boolean;
  url: string;
  copied: boolean;
  saving: boolean;
  onToggle: (enabled: boolean) => void;
  onCopy: () => void;
  onOpen: () => void;
};

export default function PublicBookingCard({
  enabled,
  url,
  copied,
  saving,
  onToggle,
  onCopy,
  onOpen,
}: Props) {
  return (
    <section className="bk-card" aria-labelledby="bk-public-title">
      <div className="bk-card-head">
        <div>
          <h2 id="bk-public-title" className="bk-card-title">
            <Globe size={15} className="text-blue-600" strokeWidth={2} />
            Public booking page
          </h2>
          <p className="bk-card-desc">
            When enabled, customers can book appointments online using your
            public booking page.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={enabled ? "bk-chip bk-chip-on" : "bk-chip bk-chip-off"}>
            {enabled ? "Enabled" : "Disabled"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Enable public booking page"
            className="bk-switch"
            data-on={enabled}
            disabled={saving}
            onClick={() => onToggle(!enabled)}
          />
        </div>
      </div>

      <div className="bk-linkbar">
        <span className="bk-linkbar-url">{url}</span>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-[12px] font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {copied ? (
            <>
              <Check size={13} className="text-green-600" /> Copied
            </>
          ) : (
            <>
              <Copy size={13} /> Copy link
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-[12px] font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <ExternalLink size={13} /> Open page
        </button>
      </div>

      {!enabled && (
        <p className="bk-hint mt-3">
          Your booking page is currently offline. Customers visiting this link
          will see that online booking is unavailable.
        </p>
      )}
    </section>
  );
}
