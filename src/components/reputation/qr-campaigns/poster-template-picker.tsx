"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  Lock,
  Palette,
  Image as ImageIcon,
  Type,
  Printer,
  LayoutTemplate,
} from "lucide-react";
import { ReviewPosterPreview } from "@/components/reputation/review-poster-preview";
import {
  CLASSIC_POSTER_TEMPLATE,
  GALLERY_POSTER_TEMPLATES,
  type PosterTemplateKey,
} from "@/lib/reputation/poster-templates";
import { cn } from "@/lib/utils";

const FEATURE_CHIPS = [
  { icon: Palette, label: "Choose Design" },
  { icon: ImageIcon, label: "Add Your Logo" },
  { icon: Type, label: "Custom Message" },
  { icon: Printer, label: "Print Ready" },
  { icon: LayoutTemplate, label: "Multiple Sizes" },
] as const;

const POSTER_DESIGN_WIDTH = 360;

const DEMO_QR =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 84 84">
      <rect width="84" height="84" fill="#fff"/>
      <g fill="#0B1B32">
        <rect x="6" y="6" width="24" height="24"/>
        <rect x="12" y="12" width="12" height="12" fill="#fff"/>
        <rect x="54" y="6" width="24" height="24"/>
        <rect x="60" y="12" width="12" height="12" fill="#fff"/>
        <rect x="6" y="54" width="24" height="24"/>
        <rect x="12" y="60" width="12" height="12" fill="#fff"/>
        <rect x="36" y="36" width="8" height="8"/>
        <rect x="48" y="36" width="8" height="8"/>
        <rect x="36" y="48" width="8" height="8"/>
        <rect x="54" y="48" width="12" height="8"/>
        <rect x="48" y="60" width="8" height="12"/>
        <rect x="66" y="54" width="8" height="8"/>
        <rect x="66" y="66" width="8" height="8"/>
      </g>
    </svg>`
  );

function TemplateThumb({
  templateKey,
  accent,
  title,
  description,
}: {
  templateKey: PosterTemplateKey;
  accent: string;
  title: string;
  description: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.42);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const width = host.clientWidth;
      if (width > 0) setScale(width / POSTER_DESIGN_WIDTH);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={hostRef} className="pointer-events-none relative h-full w-full overflow-hidden bg-[#F3F5F7]">
      <div
        className="absolute left-0 top-0"
        style={{
          width: POSTER_DESIGN_WIDTH,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <ReviewPosterPreview
          businessName="Your Business"
          templateKey={templateKey}
          qrDataUrl={DEMO_QR}
          poster={{
            title,
            description,
            brandColor: accent,
            showFooter: false,
            format: "a4",
            selectedPhrases: [],
          }}
        />
      </div>
    </div>
  );
}

export function PosterTemplatePicker({
  value,
  onChange,
  canUsePremium,
  upgradeHref,
  className,
}: {
  value: PosterTemplateKey;
  onChange: (key: PosterTemplateKey, meta: { suggestedTitle: string; suggestedDescription: string }) => void;
  canUsePremium: boolean;
  upgradeHref?: string;
  className?: string;
}) {
  const classicSelected = value === CLASSIC_POSTER_TEMPLATE;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-[#0B1220]">Choose Your QR Poster Template</h3>
            <span className="rounded-full bg-[#137752] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
              New
            </span>
          </div>
          <p className="mt-1 max-w-xl text-[13px] text-[#667085]">
            Create a striking business signage and let your customers scan and rate. Select starting point.
          </p>
        </div>
      </div>

      {/* Free default stays available; Pro gallery matches the 10-template mockup */}
      <button
        type="button"
        onClick={() =>
          onChange(CLASSIC_POSTER_TEMPLATE, {
            suggestedTitle: "Rate us on Google",
            suggestedDescription: "We value your feedback!",
          })
        }
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-bold transition",
          classicSelected
            ? "border-[#137752] bg-[#ECFDF5] text-[#137752]"
            : "border-[#E6EAF0] bg-white text-[#667085] hover:border-[#137752]/40"
        )}
      >
        {classicSelected ? <Check className="h-3.5 w-3.5" /> : null}
        Classic Green (free default)
      </button>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {GALLERY_POSTER_TEMPLATES.map((template) => {
          const selected = value === template.key;
          const locked = template.premium && !canUsePremium;
          return (
            <button
              key={template.key}
              type="button"
              disabled={locked}
              onClick={() => {
                if (locked) return;
                onChange(template.key, {
                  suggestedTitle: template.suggestedTitle,
                  suggestedDescription: template.suggestedDescription,
                });
              }}
              className={cn(
                "group relative overflow-hidden rounded-2xl border bg-white text-left transition",
                selected
                  ? "border-[#137752] ring-2 ring-[#137752]/25"
                  : "border-[#E6EAF0] hover:border-[#137752]/45",
                locked && "cursor-not-allowed opacity-85"
              )}
            >
              <span className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#137752] text-[11px] font-extrabold text-white shadow">
                {template.galleryNumber}
              </span>
              <div className="relative aspect-[3/4] overflow-hidden bg-[#F3F5F7]">
                <TemplateThumb
                  templateKey={template.key}
                  accent={template.accent}
                  title={template.suggestedTitle}
                  description={template.suggestedDescription}
                />
                {selected ? (
                  <span className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#137752] text-white shadow">
                    <Check className="h-3 w-3" />
                  </span>
                ) : null}
                {locked ? (
                  <span className="absolute inset-0 z-10 flex items-center justify-center bg-black/35">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold text-[#0B1220]">
                      <Lock className="h-3 w-3" /> Pro
                    </span>
                  </span>
                ) : null}
              </div>
              <div className="border-t border-[#F2F4F7] px-2.5 py-2">
                <p className="truncate text-[11px] font-extrabold text-[#0B1220]">{template.label}</p>
                <p className="truncate text-[10px] text-[#667085]">{template.blurb}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-[#667085]">
          {FEATURE_CHIPS.map(({ icon: Icon, label }) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5 text-[#137752]" />
              {label}
            </span>
          ))}
        </div>

        {!canUsePremium && upgradeHref ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#137752] px-4 py-3 text-white shadow-sm">
            <div>
              <p className="text-sm font-extrabold">Unlock All Templates!</p>
              <p className="text-[11px] text-white/85">Premium designs, custom branding, print-ready sizes.</p>
            </div>
            <Link
              href={upgradeHref}
              className="inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-extrabold uppercase tracking-wide text-[#137752]"
            >
              Upgrade Now
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
