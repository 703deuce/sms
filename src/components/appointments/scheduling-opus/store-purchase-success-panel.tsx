"use client";

import { CheckCircle2, CalendarPlus, Package } from "lucide-react";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { Button } from "@/newui-transplant/components/ui/button";

type Props = {
  slug: string;
  productName?: string;
  productKind?: "package" | "gift" | "membership";
  giftCode?: string | null;
  benefits?: string[];
};

export function StorePurchaseSuccessPanel({
  slug,
  productName,
  productKind,
  giftCode,
  benefits = [],
}: Props) {
  const bookHref = `/book/${encodeURIComponent(slug)}`;
  const portalHint = productKind === "package" || productKind === "membership";

  return (
    <section
      className={`${OPUS_CARD} border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-card to-card p-6 md:p-8`}
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 className="size-10 shrink-0 text-emerald-600" aria-hidden />
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Purchase complete</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {productName
                ? `Thank you — ${productName} is ready to use.`
                : "Thank you. Your purchase has been recorded."}
            </p>
          </div>

          {giftCode ? (
            <p className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
              Gift certificate code: <strong className="font-mono">{giftCode}</strong>
            </p>
          ) : null}

          {benefits.length > 0 ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                What you received
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {benefits.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button type="button" className="sm:min-w-[12rem]" onClick={() => { window.location.href = bookHref; }}>
              <CalendarPlus className="mr-2 size-4" aria-hidden />
              Book your first session
            </Button>
            {portalHint ? (
              <Button
                type="button"
                variant="outline"
                className="sm:min-w-[12rem]"
                onClick={() => { window.location.href = `/client/${encodeURIComponent(slug)}`; }}
              >
                <Package className="mr-2 size-4" aria-hidden />
                View my bookings & packages
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => { window.location.href = bookHref; }}>
                Return to booking
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
