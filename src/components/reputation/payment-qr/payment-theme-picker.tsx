"use client";

import { useEffect, useRef, useState } from "react";
import { Check, LayoutTemplate, Palette, Smartphone } from "lucide-react";
import { PaymentPageThemeIllustration } from "@/components/reputation/payment-qr/payment-page-theme-illustration";
import { TEMPLATE_SHOWCASE } from "@/lib/reputation/payment-qr/showcase-mock";
import { PAGE_THEMES, type PageThemeKey } from "@/lib/reputation/payment-qr/page-themes";
import { cn } from "@/lib/utils";

const PAYMENT_PAGE_DESIGN_WIDTH = 360;

const FEATURE_CHIPS = [
  { icon: Palette, label: "Pick a theme" },
  { icon: Smartphone, label: "Mobile-first" },
  { icon: LayoutTemplate, label: "Pay + review" },
] as const;

function PaymentPageThumb({
  theme,
  businessName,
  description,
}: {
  theme: PageThemeKey;
  businessName: string;
  description: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.42);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const width = host.clientWidth;
      if (width > 0) setScale(width / PAYMENT_PAGE_DESIGN_WIDTH);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={hostRef}
      className="pointer-events-none relative h-full w-full overflow-hidden bg-[#F3F5F7]"
    >
      <div
        className="absolute left-0 top-0"
        style={{
          width: PAYMENT_PAGE_DESIGN_WIDTH,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <PaymentPageThemeIllustration
          themeKey={theme}
          businessName={businessName}
          description={description}
        />
      </div>
    </div>
  );
}

export function PaymentThemePicker({
  value,
  onChange,
  businessName,
  className,
}: {
  value: PageThemeKey;
  onChange: (
    theme: PageThemeKey,
    meta: { suggestedDescription: string; sampleBusinessName: string }
  ) => void;
  businessName?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-base font-extrabold text-[#0B1220]">Choose Your Page Template</h3>
          <span className="rounded-full bg-[#137752] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
            Mobile
          </span>
        </div>
        <p className="mt-1 max-w-xl text-[13px] text-[#667085]">
          Each theme is a hosted pay &amp; review page — pick the look that matches your brand.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {TEMPLATE_SHOWCASE.map((item) => {
          const selected = value === item.theme;
          const previewName = businessName?.trim() || item.businessName;
          const description =
            item.configPatch.description ?? "Payments, reviews & social links";

          return (
            <button
              key={item.theme}
              type="button"
              onClick={() =>
                onChange(item.theme, {
                  suggestedDescription: description,
                  sampleBusinessName: item.businessName,
                })
              }
              className={cn(
                "group relative overflow-hidden rounded-2xl border bg-white text-left transition",
                selected
                  ? "border-[#137752] ring-2 ring-[#137752]/25"
                  : "border-[#E6EAF0] hover:border-[#137752]/45"
              )}
            >
              <span className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#137752] text-[11px] font-extrabold text-white shadow">
                {item.galleryNumber}
              </span>
              <div className="relative aspect-[3/4] overflow-hidden bg-[#F3F5F7]">
                <PaymentPageThumb
                  theme={item.theme}
                  businessName={previewName}
                  description={description}
                />
                {selected ? (
                  <span className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#137752] text-white shadow">
                    <Check className="h-3 w-3" />
                  </span>
                ) : null}
              </div>
              <div className="border-t border-[#F2F4F7] px-2.5 py-2">
                <p className="truncate text-[11px] font-extrabold text-[#0B1220]">
                  {PAGE_THEMES[item.theme].label}
                </p>
                <p className="truncate text-[10px] text-[#667085]">{item.blurb}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-[#667085]">
        {FEATURE_CHIPS.map(({ icon: Icon, label }) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 text-[#137752]" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
