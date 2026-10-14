"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronRight, Star } from "lucide-react";
import { PaymentProviderIcon } from "@/components/reputation/payment-qr/payment-provider-icons";
import { getPaymentProvider } from "@/lib/reputation/payment-qr/providers";
import {
  type PaymentPageConfiguration,
  type PaymentProvider,
} from "@/lib/reputation/payment-qr/types";
import { cn } from "@/lib/utils";

function formatAmountLabel(amountCents: number, label: string | null): string {
  if (label?.trim()) return label.trim();
  return `$${(amountCents / 100).toFixed(0)}`;
}

async function trackEvent(
  slug: string,
  eventType: string,
  extra?: { provider?: PaymentProvider; amountSelectedCents?: number }
) {
  try {
    await fetch("/api/public/payment-qr/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        eventType,
        sessionId: crypto.randomUUID(),
        provider: extra?.provider,
        amountSelectedCents: extra?.amountSelectedCents,
      }),
    });
  } catch {
    // non-blocking
  }
}

/**
 * Payment + review center slot inside brand poster layouts (replaces QR block).
 */
export function PaymentHostedCenter({
  slug,
  config,
  isPreview = false,
  dark = false,
}: {
  slug: string;
  config: PaymentPageConfiguration;
  isPreview?: boolean;
  /** Poster uses dark backgrounds (elegant black, premium gold) */
  dark?: boolean;
}) {
  const [selectedAmountCents, setSelectedAmountCents] = useState<number | null>(() => {
    if (!isPreview) return null;
    const first = config.suggestedAmounts.filter((a) => a.enabled).sort((a, b) => a.sortOrder - b.sortOrder)[0];
    return first?.amountCents ?? null;
  });

  const methods = useMemo(
    () =>
      config.methods
        .filter((m) => m.enabled && (m.publicHandle?.trim() || m.publicUrl?.trim()))
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [config.methods]
  );

  const amounts = useMemo(
    () =>
      config.suggestedAmounts.filter((a) => a.enabled).sort((a, b) => a.sortOrder - b.sortOrder),
    [config.suggestedAmounts]
  );

  const requiresAmount = config.amountMode === "suggested" || config.amountMode === "custom";
  const effectiveAmount = selectedAmountCents;

  const handlePayment = useCallback(
    async (provider: PaymentProvider) => {
      if (requiresAmount && (!effectiveAmount || effectiveAmount <= 0)) return;
      if (isPreview) return;
      const res = await fetch("/api/public/payment-qr/open-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          provider,
          amountCents: effectiveAmount,
          sessionId: crypto.randomUUID(),
        }),
      });
      const json = (await res.json()) as { destinationUrl?: string | null };
      if (json.destinationUrl) window.open(json.destinationUrl, "_blank", "noopener,noreferrer");
    },
    [slug, effectiveAmount, requiresAmount, isPreview]
  );

  const textPrimary = dark ? "text-white" : "text-[#0B1220]";
  const textMuted = dark ? "text-white/70" : "text-[#667085]";
  const cardBg = dark ? "bg-white/10" : "bg-white";
  const cardBorder = dark ? "border-white/20" : "border-[#E6EAF0]";

  return (
    <div className="w-full space-y-2.5 text-left">
      {config.amountMode === "suggested" && amounts.length > 0 ? (
        <div>
          <p className={cn("text-[9px] font-bold uppercase tracking-wider", textMuted)}>Tip amount</p>
          <div className="mt-1.5 flex flex-wrap justify-center gap-1.5">
            {amounts.slice(0, 4).map((a) => {
              const selected = selectedAmountCents === a.amountCents;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedAmountCents(a.amountCents)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[10px] font-bold transition",
                    selected
                      ? dark
                        ? "border-[#D4AF37] bg-[#D4AF37] text-[#0B0B0B]"
                        : "border-[#137752] bg-[#137752] text-white"
                      : dark
                        ? "border-white/30 bg-white/10 text-white"
                        : "border-[#E6EAF0] bg-white text-[#0B1220]"
                  )}
                >
                  {formatAmountLabel(a.amountCents, a.label)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div>
        <p className={cn("text-[9px] font-bold uppercase tracking-wider", textMuted)}>Choose payment</p>
        <div className="mt-1.5 space-y-1.5">
          {methods.map((method) => {
            const def = getPaymentProvider(method.provider);
            const blocked = requiresAmount && (!effectiveAmount || effectiveAmount <= 0);
            return (
              <button
                key={method.id}
                type="button"
                disabled={blocked}
                onClick={() => void handlePayment(method.provider)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left shadow-sm transition hover:opacity-95 disabled:opacity-45",
                  cardBg,
                  cardBorder
                )}
              >
                <PaymentProviderIcon provider={method.provider} variant="color" />
                <span className={cn("flex-1 text-[11px] font-bold", textPrimary)}>{def.buttonLabel}</span>
                <ChevronRight className={cn("h-4 w-4 shrink-0 opacity-40", textMuted)} />
              </button>
            );
          })}
        </div>
      </div>

      {config.googleReviewUrl ? (
        <div className={cn("rounded-lg border p-3 text-center", cardBg, cardBorder)}>
          <div className="flex justify-center gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="h-3 w-3 fill-[#F59E0B] text-[#F59E0B]" />
            ))}
          </div>
          <p className={cn("mt-1.5 text-[11px] font-bold", textPrimary)}>Enjoyed your experience?</p>
          <button
            type="button"
            onClick={() => {
              if (!isPreview && config.googleReviewUrl) {
                void trackEvent(slug, "google_review_clicked");
                window.open(config.googleReviewUrl, "_blank", "noopener,noreferrer");
              }
            }}
            className={cn(
              "mt-2 w-full rounded-lg py-2.5 text-[11px] font-extrabold text-white shadow-md",
              dark ? "bg-[#D4AF37] text-[#0B0B0B]" : "bg-[#137752]"
            )}
          >
            Leave a Google Review
          </button>
        </div>
      ) : null}
    </div>
  );
}
