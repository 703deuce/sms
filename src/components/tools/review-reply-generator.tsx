"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Copy, Loader2, Sparkles, PencilLine } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FreeToolField,
  FreeToolShell,
  freeToolInputClass,
  freeToolPrimaryBtnClass,
} from "@/components/tools/free-tool-shell";

const TONES = [
  { id: "friendly", label: "Friendly" },
  { id: "professional", label: "Professional" },
  { id: "grateful", label: "Empathetic" },
  { id: "concise", label: "Concise" },
] as const;

const SAMPLE_REVIEWS = [
  {
    id: "tyler",
    author: "Tyler Moore",
    rating: 5,
    when: "2 weeks ago",
    text: "Great service from start to finish. Highly recommend for anyone looking for quality work.",
  },
  {
    id: "maria",
    author: "Maria L.",
    rating: 4,
    when: "1 month ago",
    text: "Great experience overall. Friendly staff and fair pricing. Would come back again.",
  },
  {
    id: "custom",
    author: "Custom review",
    rating: 5,
    when: "Just now",
    text: "",
  },
] as const;

export function ReviewReplyGenerator({ embed = false }: { embed?: boolean }) {
  const [businessName, setBusinessName] = useState("");
  const [selectedId, setSelectedId] = useState<(typeof SAMPLE_REVIEWS)[number]["id"]>("tyler");
  const [customText, setCustomText] = useState("");
  const [tone, setTone] = useState<(typeof TONES)[number]["id"]>("friendly");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);

  const active = useMemo(
    () => SAMPLE_REVIEWS.find((r) => r.id === selectedId) ?? SAMPLE_REVIEWS[0],
    [selectedId]
  );

  const reviewText = selectedId === "custom" ? customText : active.text;
  const hasResult = Boolean(reply.trim());

  async function generate() {
    setLoading(true);
    setError(null);
    setEditing(false);
    try {
      const res = await fetch("/api/public/review-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, reviewText, tone }),
      });
      const json = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
      if (!res.ok || !json.reply) {
        throw new Error(json.error || "Could not generate a reply");
      }
      setReply(json.reply);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate a reply");
    } finally {
      setLoading(false);
    }
  }

  async function copyReply() {
    if (!reply) return;
    await navigator.clipboard.writeText(reply);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <FreeToolShell
      embed={embed}
      title="AI Review Reply Generator"
      subtitle="Select a review, choose a tone, and generate a professional Google reply."
      steps={[
        { label: "Connect GMB account" },
        { label: "Select a Review" },
        { label: "AI Generates a Reply" },
        { label: "Review and Post" },
      ]}
      ctaHref="/sign-up"
      ctaLabel="Start Free Trial"
      footerNote="Get more reviews with review requests, QR codes, and follow-ups."
    >
      {!hasResult ? (
        <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4">
            <FreeToolField label="Business name">
              <input
                className={freeToolInputClass}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Your business name"
              />
            </FreeToolField>

            <FreeToolField label="Select a Review">
              <select
                className={freeToolInputClass}
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value as typeof selectedId)}
              >
                {SAMPLE_REVIEWS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id === "custom" ? "Paste your own review…" : `${r.author} · ${r.rating} stars`}
                  </option>
                ))}
              </select>
            </FreeToolField>

            {selectedId === "custom" ? (
              <FreeToolField label="Paste review text">
                <textarea
                  className={cn(freeToolInputClass, "min-h-[120px] h-auto py-2.5")}
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="Paste the customer’s Google review here…"
                />
              </FreeToolField>
            ) : null}

            <div>
              <p className="mb-1.5 text-[12px] font-bold text-[#344054]">Choose a Tone</p>
              <div className="grid grid-cols-2 gap-2">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTone(t.id)}
                    className={cn(
                      "rounded-xl border px-3.5 py-2.5 text-[13px] font-bold",
                      tone === t.id
                        ? "border-[#137752] bg-[#ECFDF5] text-[#137752]"
                        : "border-[#D0D5DD] bg-white text-[#344054]"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={loading || reviewText.trim().length < 8}
              onClick={() => void generate()}
              className={cn(freeToolPrimaryBtnClass, "w-full")}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate AI Reply
            </button>
            {error ? <p className="text-sm text-[#B42318]">{error}</p> : null}
          </div>

          <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#D0D5DD] bg-[#F9FAFB] p-6 text-center">
            <Sparkles className="mb-3 h-8 w-8 text-[#137752]" />
            <p className="text-sm font-semibold text-[#344054]">Your suggested reply will appear here</p>
            <p className="mt-1 max-w-[28ch] text-[12px] text-[#667085]">
              Pick a review and tone, then generate.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[#E6EAF0] bg-white p-5 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">The Review</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-extrabold text-[#0B1220]">
                    {selectedId === "custom" ? "Your customer" : active.author}
                  </p>
                  <p className="text-[12px] text-[#98A2B3]">{active.when}</p>
                </div>
                <span className="text-[#FDB022]">{"★".repeat(active.rating)}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#475467]">{reviewText}</p>
            </div>

            <div className="rounded-2xl border border-[#E6EAF0] bg-white p-5 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">
                Suggested Reply
              </p>
              {editing ? (
                <textarea
                  className={cn(freeToolInputClass, "mt-3 min-h-[140px] h-auto py-2.5")}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                />
              ) : (
                <p className="mt-3 min-h-[140px] whitespace-pre-wrap text-sm leading-relaxed text-[#144C34]">
                  {reply}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => void copyReply()} className={freeToolPrimaryBtnClass}>
                  <Copy className="h-4 w-4" />
                  {copied ? "Copied" : "Copy Reply"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing((v) => !v)}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-[#D0D5DD] bg-white px-5 text-sm font-bold text-[#344054]"
                >
                  <PencilLine className="h-4 w-4" />
                  {editing ? "Done editing" : "Edit reply"}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void generate()}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-[#D0D5DD] bg-white px-4 text-sm font-bold text-[#344054]"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Regenerate
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#ECFDF5] px-5 py-4">
            <div>
              <p className="text-sm font-extrabold text-[#027A48]">
                Get more reviews with our Google Review Generator
              </p>
              <p className="mt-0.5 text-[12px] text-[#027A48]/85">
                Send requests, QR posters, and follow-ups from one place.
              </p>
            </div>
            <Link
              href="/sign-up"
              className="inline-flex h-10 items-center rounded-full bg-[#137752] px-4 text-sm font-bold text-white"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      )}
    </FreeToolShell>
  );
}
