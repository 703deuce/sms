"use client";

import { CreditCard, Layers, ShoppingBag } from "lucide-react";
import type { MembershipFormState } from "@/lib/appointments/memberships/membership-form";
import {
  accessSummary,
  formatBillingInterval,
  formatMoney,
} from "@/lib/appointments/memberships/membership-form";
import type { OfferingOption } from "@/features/appointments/kimi/memberships/use-membership-editor";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { OpusIconBadge, Pill } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { cn } from "@/lib/utils";
import { OfferingCoverImage } from "./offering-cover-image";

type Props = {
  form: MembershipFormState;
  includedOfferings: OfferingOption[];
  mode?: "draft" | "preview" | "published";
  className?: string;
};

export function MembershipLivePreview({
  form,
  includedOfferings,
  mode = "draft",
  className,
}: Props) {
  const access = accessSummary(form);

  return (
    <section
      className={cn(
        OPUS_CARD,
        "overflow-hidden bg-gradient-to-br from-card via-card to-primary/[0.06] p-5",
        className,
      )}
    >
      <OfferingCoverImage
        imageUrl={form.imageUrl}
        category="membership"
        alt={form.name || "Membership cover"}
        className="mb-4"
      />
      <div className="flex items-start justify-between gap-3">
        <OpusIconBadge icon={CreditCard} className="size-10 rounded-xl bg-primary/12" />
        <Pill tone={mode === "published" ? "success" : "neutral"} dot={false}>
          {mode === "published" ? "Published" : mode === "preview" ? "Preview" : "Draft"}
        </Pill>
      </div>
      <h2 className="mt-2 text-lg font-semibold tracking-tight">
        {form.name.trim() || "Untitled membership"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Recurring membership</p>
      {form.description ? (
        <p className="mt-3 text-sm text-muted-foreground line-clamp-4">{form.description}</p>
      ) : null}

      <div className="mt-5 border-t pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Price</p>
        <p className="text-2xl font-semibold tabular-nums">
          {formatMoney(form.priceCents)}
          <span className="text-base font-normal text-muted-foreground">
            {" "}
            / {formatBillingInterval(form.billingInterval).toLowerCase()}
          </span>
        </p>
      </div>

      <div className="mt-4 border-t pt-4">
        <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Layers className="size-3.5" aria-hidden />
          Included access
        </p>
        {includedOfferings.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add eligible bookings to preview benefits.</p>
        ) : (
          <ul className="space-y-2">
            {includedOfferings.slice(0, 8).map((o) => (
              <li key={o.id} className="truncate text-sm">{o.name}</li>
            ))}
            {includedOfferings.length > 8 ? (
              <li className="text-xs text-muted-foreground">
                +{includedOfferings.length - 8} more
              </li>
            ) : null}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">{access.label}</p>
      </div>

      <Button type="button" className="mt-5 w-full" variant="secondary" disabled>
        <ShoppingBag className="mr-2 size-4" aria-hidden />
        Subscribe
      </Button>
      <p className="mt-2 text-center text-xs text-muted-foreground">Customer preview — not live checkout</p>
    </section>
  );
}
