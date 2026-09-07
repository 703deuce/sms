"use client";

import React, { useCallback, useState } from "react";
import { Code, Copy, Check, ExternalLink, Link2 } from "lucide-react";
import { appointmentTypes, bookingUrl, workspace } from "../mock-data";

type SingleUseLink = {
  id: string;
  token: string;
  appointmentTypeId: string;
  appointmentTypeName: string;
  maxUses: number;
  usedCount: number;
};

const MOCK_LINKS: SingleUseLink[] = [
  {
    id: "sul_1",
    token: "tok_8f2a9c",
    appointmentTypeId: "t1",
    appointmentTypeName: "New Patient Exam",
    maxUses: 1,
    usedCount: 0,
  },
];

export default function ShareEmbedCard() {
  const [copied, setCopied] = useState<string | null>(null);
  const [typeId, setTypeId] = useState("");
  const [links, setLinks] = useState<SingleUseLink[]>(MOCK_LINKS);

  const embedUrl = `${bookingUrl.replace("/book/", "/embed/book/")}`;
  const embedIframe = `<iframe src="${embedUrl}" width="100%" height="720" frameborder="0" title="Book appointment"></iframe>`;
  const popupScript = `<script src="https://app.transovo.com/widget/booking.js" data-slug="${workspace.slug}" async></script>`;

  const copy = useCallback((text: string, key: string) => {
    try {
      void navigator.clipboard.writeText(text);
    } catch {
      /* sandbox */
    }
    setCopied(key);
    window.setTimeout(() => setCopied(null), 2000);
  }, []);

  function createLink() {
    if (!typeId) return;
    const type = appointmentTypes.find((t) => t.id === typeId);
    if (!type) return;
    setLinks((prev) => [
      {
        id: `sul_${Date.now()}`,
        token: `tok_${Math.random().toString(36).slice(2, 8)}`,
        appointmentTypeId: type.id,
        appointmentTypeName: type.name,
        maxUses: 1,
        usedCount: 0,
      },
      ...prev,
    ]);
    setTypeId("");
  }

  return (
    <>
      <section className="bk-card" aria-labelledby="bk-embed-title">
        <h2 id="bk-embed-title" className="bk-card-title">
          <Code size={15} className="text-blue-600" strokeWidth={2} />
          Inline embed
        </h2>
        <p className="bk-card-desc">
          Embed your booking page on your website with an iframe snippet.
        </p>
        <textarea
          className="bk-textarea mt-3 font-mono text-[11.5px]"
          rows={3}
          readOnly
          value={embedIframe}
          aria-label="Embed code"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => copy(embedIframe, "embed")}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-[12px] font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            {copied === "embed" ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
            {copied === "embed" ? "Copied" : "Copy embed code"}
          </button>
          <a
            href={embedUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-[12px] font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            <ExternalLink size={13} /> Preview embed
          </a>
        </div>
      </section>

      <section className="bk-card" aria-labelledby="bk-popup-title">
        <h2 id="bk-popup-title" className="bk-card-title">
          <Link2 size={15} className="text-blue-600" strokeWidth={2} />
          Popup widget
        </h2>
        <p className="bk-card-desc">
          Add a floating &ldquo;Book now&rdquo; button that opens your booking page in a popup.
        </p>
        <textarea
          className="bk-textarea mt-3 font-mono text-[11.5px]"
          rows={2}
          readOnly
          value={popupScript}
          aria-label="Popup widget script"
        />
        <button
          type="button"
          className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-[12px] font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
          onClick={() => copy(popupScript, "popup")}
        >
          {copied === "popup" ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
          {copied === "popup" ? "Copied" : "Copy popup script"}
        </button>
      </section>

      <section className="bk-card" aria-labelledby="bk-singleuse-title">
        <h2 id="bk-singleuse-title" className="bk-card-title">Single-use booking links</h2>
        <p className="bk-card-desc">
          Generate a one-time link for a specific booking type — useful for referrals or private offers.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            className="bk-select min-w-[200px] flex-1"
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            aria-label="Appointment type for single-use link"
          >
            <option value="">Select booking type</option>
            {appointmentTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button
            type="button"
            className="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-[12px] font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
            onClick={createLink}
            disabled={!typeId}
          >
            Create link
          </button>
        </div>
        {links.length === 0 ? (
          <p className="bk-hint mt-3">No single-use links yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {links.map((link) => {
              const url = `${bookingUrl}?singleUse=${link.token}&type=${link.appointmentTypeId}`;
              return (
                <li
                  key={link.id}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-gray-800">{link.appointmentTypeName}</p>
                    <p className="truncate font-mono text-[11px] text-gray-500">{url}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-gray-500">
                    {link.usedCount}/{link.maxUses} uses
                  </span>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 shadow-sm"
                    onClick={() => copy(url, link.id)}
                    aria-label="Copy link"
                  >
                    {copied === link.id ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
