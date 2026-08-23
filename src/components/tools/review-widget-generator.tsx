"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Loader2, Search, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FreeToolField,
  FreeToolShell,
  freeToolInputClass,
  freeToolPrimaryBtnClass,
} from "@/components/tools/free-tool-shell";

type PlaceCandidate = {
  place_id: string;
  name: string;
  address: string;
  rating?: number;
  review_count?: number;
};

type LayoutId = "badge" | "bar" | "cards";

type SelectableReview = {
  id: string;
  author: string;
  rating: number;
  text: string;
  selected: boolean;
};

const LAYOUTS: { id: LayoutId; label: string; blurb: string }[] = [
  { id: "badge", label: "Badge", blurb: "Compact stars + rating" },
  { id: "bar", label: "Bar", blurb: "Full-width review strip" },
  { id: "cards", label: "Cards", blurb: "Up to 3 review quotes" },
];

const DEFAULT_REVIEWS: SelectableReview[] = [
  {
    id: "r1",
    author: "Sarah M.",
    rating: 5,
    text: "They asked for a review after the job—super easy. Great service.",
    selected: true,
  },
  {
    id: "r2",
    author: "James T.",
    rating: 5,
    text: "Showed up on time and fixed everything. Highly recommend.",
    selected: true,
  },
  {
    id: "r3",
    author: "Priya K.",
    rating: 4,
    text: "Friendly team and clear communication from start to finish.",
    selected: false,
  },
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stars(rating: number): string {
  const full = Math.max(0, Math.min(5, Math.round(rating)));
  return "★".repeat(full) + "☆".repeat(5 - full);
}

function reviewUrl(placeId: string): string {
  return `https://search.google.com/local/reviews?placeid=${encodeURIComponent(placeId)}`;
}

function buildEmbed(params: {
  layout: LayoutId;
  businessName: string;
  placeId: string;
  rating: number;
  reviewCount: number;
  quotes: string[];
}): string {
  const name = escapeHtml(params.businessName || "Our business");
  const rating = Number.isFinite(params.rating) ? params.rating : 5;
  const count = Math.max(0, Math.floor(params.reviewCount || 0));
  const href = escapeHtml(reviewUrl(params.placeId || "PLACE_ID"));
  const starText = stars(rating);
  const quotes = params.quotes.map((q) => q.trim()).filter(Boolean).slice(0, 3);

  const css = `<style>
.lse-rw{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0B1220;line-height:1.45}
.lse-rw a{color:inherit;text-decoration:none}
.lse-rw-badge{display:inline-flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid #E6EAF0;border-radius:12px;background:#fff}
.lse-rw-stars{color:#FDB022;letter-spacing:1px;font-size:16px}
.lse-rw-meta{font-size:13px;color:#344054}
.lse-rw-meta strong{display:block;font-size:14px;color:#0B1220}
.lse-rw-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border:1px solid #E6EAF0;border-radius:14px;background:#F7FAF8}
.lse-rw-cta{display:inline-flex;align-items:center;padding:8px 12px;border-radius:8px;background:#137752;color:#fff!important;font-size:13px;font-weight:600}
.lse-rw-cards{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
.lse-rw-card{padding:14px;border:1px solid #E6EAF0;border-radius:12px;background:#fff}
.lse-rw-card p{margin:8px 0 0;font-size:13px;color:#475467}
.lse-rw-foot{margin-top:8px;font-size:11px;color:#98A2B3}
</style>`;

  if (params.layout === "badge") {
    return `${css}
<div class="lse-rw">
  <a class="lse-rw-badge" href="${href}" target="_blank" rel="noopener noreferrer">
    <span class="lse-rw-stars" aria-hidden="true">${starText}</span>
    <span class="lse-rw-meta"><strong>${rating.toFixed(1)} on Google</strong>${count.toLocaleString()} reviews · ${name}</span>
  </a>
  <div class="lse-rw-foot">Powered by Local SEO Express</div>
</div>`;
  }

  if (params.layout === "bar") {
    return `${css}
<div class="lse-rw">
  <div class="lse-rw-bar">
    <div>
      <div class="lse-rw-stars" aria-hidden="true">${starText}</div>
      <div class="lse-rw-meta"><strong>${name}</strong>${rating.toFixed(1)} average from ${count.toLocaleString()} Google reviews</div>
    </div>
    <a class="lse-rw-cta" href="${href}" target="_blank" rel="noopener noreferrer">Read reviews</a>
  </div>
  <div class="lse-rw-foot">Powered by Local SEO Express</div>
</div>`;
  }

  const cards =
    quotes.length > 0
      ? quotes
          .map(
            (q) =>
              `<div class="lse-rw-card"><div class="lse-rw-stars" aria-hidden="true">${starText}</div><p>“${escapeHtml(q)}”</p></div>`
          )
          .join("\n")
      : `<div class="lse-rw-card"><div class="lse-rw-stars" aria-hidden="true">${starText}</div><p>Customers rate ${name} ${rating.toFixed(1)} stars on Google (${count.toLocaleString()} reviews).</p></div>`;

  return `${css}
<div class="lse-rw">
  <div class="lse-rw-cards">
${cards}
  </div>
  <div style="margin-top:12px"><a class="lse-rw-cta" href="${href}" target="_blank" rel="noopener noreferrer">See all Google reviews</a></div>
  <div class="lse-rw-foot">Powered by Local SEO Express</div>
</div>`;
}

function Sparkline() {
  return (
    <svg viewBox="0 0 120 36" className="h-9 w-[120px]" aria-hidden="true">
      <path
        d="M2 28 C18 26, 24 18, 36 16 S56 22, 68 14 S92 8, 118 6"
        fill="none"
        stroke="#137752"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M2 28 C18 26, 24 18, 36 16 S56 22, 68 14 S92 8, 118 6 L118 36 L2 36 Z"
        fill="rgba(19,119,82,0.12)"
      />
    </svg>
  );
}

export function ReviewWidgetGenerator({ embed = false }: { embed?: boolean }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<PlaceCandidate[]>([]);
  const [selected, setSelected] = useState<PlaceCandidate | null>(null);
  const [businessName, setBusinessName] = useState("Your Business");
  const [placeId, setPlaceId] = useState("");
  const [rating, setRating] = useState(4.8);
  const [reviewCount, setReviewCount] = useState(35);
  const [layout, setLayout] = useState<LayoutId>("cards");
  const [reviews, setReviews] = useState<SelectableReview[]>(DEFAULT_REVIEWS);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishBlocked, setPublishBlocked] = useState(false);
  const [phase, setPhase] = useState<"builder" | "result">("builder");

  useEffect(() => {
    if (!selected) return;
    setBusinessName(selected.name);
    setPlaceId(selected.place_id);
    if (typeof selected.rating === "number") setRating(selected.rating);
    if (typeof selected.review_count === "number") setReviewCount(selected.review_count);
  }, [selected]);

  const selectedQuotes = reviews.filter((r) => r.selected).map((r) => r.text);

  const embedCode = useMemo(
    () =>
      buildEmbed({
        layout,
        businessName,
        placeId,
        rating,
        reviewCount,
        quotes: selectedQuotes,
      }),
    [layout, businessName, placeId, rating, reviewCount, selectedQuotes]
  );

  async function searchPlaces() {
    setSearching(true);
    setError(null);
    setCandidates([]);
    try {
      const res = await fetch("/api/public/qr/places-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        candidates?: PlaceCandidate[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Search failed");
      setCandidates(json.candidates ?? []);
      if (!(json.candidates ?? []).length) {
        setError("No matching businesses found. Enter details manually.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function copyEmbed() {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setPublishBlocked(true);
        setPhase("result");
        return;
      }
    } catch {
      setPublishBlocked(true);
      setPhase("result");
      return;
    }
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setPhase("result");
    window.setTimeout(() => setCopied(false), 1600);
  }

  function goToResult() {
    setPhase("result");
  }

  const fiveStarApprox = Math.max(0, Math.round(reviewCount * 0.9));
  const fourStarApprox = Math.max(0, reviewCount - fiveStarApprox);
  const recentApprox = Math.min(21, Math.max(2, Math.round(reviewCount * 0.06)));

  function toggleReview(id: string) {
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r)));
  }

  return (
    <FreeToolShell
      embed={embed}
      title="Google Review Widget Generator"
      subtitle="Select a style, choose reviews, customize, and embed on your website."
      steps={[
        { label: "Select a Style" },
        { label: "Choose Your Reviews" },
        { label: "Customize Widget" },
        { label: "Embed to Website" },
      ]}
      ctaHref="/sign-up"
      ctaLabel="Start Free Trial"
      footerNote="Ready to get more reviews automatically?"
    >
      {phase === "result" ? (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-2xl border border-[#E6EAF0] bg-white p-5 shadow-sm">
              <div className="flex items-end gap-3">
                <span className="text-5xl font-extrabold tracking-tight text-[#0B1220]">
                  {rating.toFixed(1)}
                </span>
                <div className="pb-1">
                  <span className="text-lg text-[#FDB022]">★★★★★</span>
                  <p className="text-[12px] text-[#667085]">Based on {reviewCount.toLocaleString()} reviews</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-[#F9FAFB] p-3 text-center">
                  <p className="text-lg font-extrabold text-[#0B1220]">{recentApprox}</p>
                  <p className="text-[11px] font-bold text-[#667085]">Recent Reviews</p>
                </div>
                <div className="rounded-xl bg-[#F9FAFB] p-3 text-center">
                  <p className="text-lg font-extrabold text-[#137752]">{fiveStarApprox}</p>
                  <p className="text-[11px] font-bold text-[#667085]">5-star</p>
                </div>
                <div className="rounded-xl bg-[#F9FAFB] p-3 text-center">
                  <p className="text-lg font-extrabold text-[#0B1220]">{fourStarApprox}</p>
                  <p className="text-[11px] font-bold text-[#667085]">4-star</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-[#0B1220]">
                  Showcase your best reviews on your site and build trust with your visitors.
                </h2>
                <p className="mt-1 text-sm text-[#667085]">
                  Preview is ready. Copy the embed code after you create a free account to publish a live widget.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copyEmbed()}
                className={cn(freeToolPrimaryBtnClass, "w-full sm:w-auto")}
              >
                <Copy className="h-4 w-4" />
                {copied ? "Copied Widget Code" : "Copy Widget Code"}
              </button>
              {publishBlocked ? (
                <div className="rounded-xl border border-[#FEC84B]/70 bg-[#FFFAEB] p-4">
                  <p className="text-sm font-bold text-[#B54708]">Account required to publish</p>
                  <p className="mt-1 text-[12px] text-[#667085]">
                    Create a free account to get live embed code and keep the widget connected.
                  </p>
                  <a
                    href="/sign-up?next=/tools/google-review-widget"
                    className="mt-3 inline-flex h-10 items-center rounded-full bg-[#137752] px-4 text-sm font-bold text-white"
                  >
                    Create free account to publish
                  </a>
                </div>
              ) : null}
              <div className="rounded-2xl border border-[#E6EAF0] bg-[#F9FAFB] p-4">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#667085]">
                  Widget preview
                </p>
                <iframe
                  title="Widget preview"
                  sandbox=""
                  srcDoc={embedCode}
                  className="min-h-[120px] w-full border-0 bg-transparent"
                />
              </div>
              {!publishBlocked ? (
                <textarea
                  readOnly
                  className={cn(freeToolInputClass, "min-h-[120px] h-auto py-2 font-mono text-[11px]")}
                  value={embedCode}
                />
              ) : null}
              <button
                type="button"
                onClick={() => setPhase("builder")}
                className="text-sm font-bold text-[#667085] hover:text-[#137752]"
              >
                ← Back to customize
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#ECFDF5] px-5 py-4">
            <div>
              <p className="text-sm font-extrabold text-[#027A48]">
                Ready to get more reviews automatically?
              </p>
              <p className="mt-0.5 text-[12px] text-[#027A48]/85">
                Start a free trial for review requests, QR tracking, and follow-ups.
              </p>
            </div>
            <a
              href="/sign-up"
              className="inline-flex h-10 items-center rounded-full bg-[#137752] px-4 text-sm font-bold text-white"
            >
              Start Free Trial
            </a>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-5 grid gap-3 rounded-2xl border border-[#E6EAF0] bg-[#F9FAFB] p-4 sm:grid-cols-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">Average rating</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-3xl font-extrabold text-[#0B1220]">{rating.toFixed(1)}</span>
                <span className="text-[#FDB022]">★★★★★</span>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">Total Reviews</p>
              <p className="mt-1 text-2xl font-extrabold text-[#0B1220]">{reviewCount}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">New Reviews</p>
              <p className="mt-1 text-2xl font-extrabold text-[#137752]">2</p>
            </div>
            <div className="flex flex-col justify-end">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#667085]">Rating trend</p>
              <Sparkline />
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex justify-center">
              <div className="relative w-[220px]">
                <div className="rounded-[36px] bg-[#111827] p-2.5 shadow-xl">
                  <div className="overflow-hidden rounded-[28px] bg-white p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Star className="h-4 w-4 text-[#137752]" />
                      <span className="text-[12px] font-bold text-[#0B1220]">Review widget</span>
                    </div>
                    <iframe
                      title="Review widget phone preview"
                      sandbox=""
                      srcDoc={embedCode}
                      className="min-h-[220px] w-full rounded-xl border-0 bg-[#F9FAFB] p-2"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <FreeToolField label="Find your Google Business Profile">
                <div className="flex gap-2">
                  <input
                    className={freeToolInputClass}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Business name + city"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void searchPlaces();
                    }}
                  />
                  <button
                    type="button"
                    disabled={searching || query.trim().length < 2}
                    onClick={() => void searchPlaces()}
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#D0D5DD] px-3 text-sm font-bold text-[#344054] disabled:opacity-50"
                  >
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Find
                  </button>
                </div>
              </FreeToolField>

              {candidates.length > 0 ? (
                <ul className="max-h-36 overflow-auto rounded-xl border border-[#E6EAF0]">
                  {candidates.map((c) => (
                    <li key={c.place_id}>
                      <button
                        type="button"
                        onClick={() => setSelected(c)}
                        className={cn(
                          "w-full border-b border-[#F2F4F7] px-3 py-2 text-left text-sm last:border-0 hover:bg-[#F7FAF8]",
                          selected?.place_id === c.place_id && "bg-[#ECFDF5]"
                        )}
                      >
                        <span className="font-semibold text-[#0B1220]">{c.name}</span>
                        <span className="mt-0.5 block text-[12px] text-[#667085]">{c.address}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div>
                <p className="mb-1.5 text-[12px] font-bold text-[#344054]">1. Select a Style</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {LAYOUTS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setLayout(item.id)}
                      className={cn(
                        "rounded-xl border p-3 text-left",
                        layout === item.id ? "border-[#137752] bg-[#ECFDF5]" : "border-[#D0D5DD] bg-white"
                      )}
                    >
                      <span className="block text-[13px] font-bold text-[#0B1220]">{item.label}</span>
                      <span className="mt-1 block text-[11px] text-[#667085]">{item.blurb}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-[12px] font-bold text-[#344054]">2. Select Reviews</p>
                <ul className="space-y-2">
                  {reviews.map((review) => (
                    <li key={review.id}>
                      <button
                        type="button"
                        onClick={() => toggleReview(review.id)}
                        className={cn(
                          "w-full rounded-xl border px-3 py-2.5 text-left",
                          review.selected ? "border-[#137752] bg-[#ECFDF5]" : "border-[#E6EAF0] bg-white"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-[#0B1220]">{review.author}</span>
                          <span className="text-[12px] text-[#FDB022]">{"★".repeat(review.rating)}</span>
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-[#667085]">{review.text}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <FreeToolField label="Business name">
                  <input
                    className={freeToolInputClass}
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                  />
                </FreeToolField>
                <FreeToolField label="Place ID">
                  <input
                    className={freeToolInputClass}
                    value={placeId}
                    onChange={(e) => setPlaceId(e.target.value)}
                    placeholder="ChIJ…"
                  />
                </FreeToolField>
              </div>

              {error ? <p className="text-sm text-[#B42318]">{error}</p> : null}

              <button type="button" onClick={goToResult} className={cn(freeToolPrimaryBtnClass, "w-full")}>
                Generate Widget
              </button>
            </div>
          </div>
        </>
      )}
    </FreeToolShell>
  );
}
