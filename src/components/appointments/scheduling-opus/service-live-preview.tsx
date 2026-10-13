"use client";

import type { LucideIcon } from "lucide-react";
import { Briefcase, Clock, MapPin, Tag, UserRound, Wallet } from "lucide-react";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import { formatDurationMinutes } from "@/lib/appointments/duration-display";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { OpusIconBadge, Pill } from "@/newui-transplant/components/app/kit";
import { cn } from "@/lib/utils";
import { OfferingCoverImage } from "./offering-cover-image";

function priceSummary(form: AppointmentTypeFormState): string {
  if (form.paymentPriceCents <= 0) return "Free";
  const amount = `$${(form.paymentPriceCents / 100).toFixed(2)}`;
  if (form.paymentMode === "full") return `${amount} · paid at booking`;
  if (form.paymentMode === "deposit") return `${amount} · deposit at booking`;
  return `${amount} · paid in person`;
}

type Props = {
  form: AppointmentTypeFormState;
  staffNames: Map<string, string>;
  locationNames: Map<string, string>;
  categoryName: string;
  className?: string;
};

export function ServiceLivePreview({
  form,
  staffNames,
  locationNames,
  categoryName,
  className,
}: Props) {
  const staff = form.staffIds.map((id) => staffNames.get(id)).filter(Boolean) as string[];
  const places = form.locationIds.map((id) => locationNames.get(id)).filter(Boolean) as string[];
  const rows: Array<{ icon: LucideIcon; label: string; value: string; set: boolean }> = [
    { icon: Tag, label: "Category", value: categoryName || "None", set: Boolean(categoryName) },
    {
      icon: Clock,
      label: "Duration",
      value: formatDurationMinutes(form.durationMinutes),
      set: form.durationMinutes >= 5,
    },
    {
      icon: UserRound,
      label: "Staff",
      value: staff.length ? staff.join(", ") : "Any available",
      set: true,
    },
    {
      icon: MapPin,
      label: "Location",
      value: places.length ? places.join(", ") : "Not set",
      set: places.length > 0,
    },
    { icon: Wallet, label: "Price", value: priceSummary(form), set: true },
  ];

  return (
    <section className={cn(OPUS_CARD, "overflow-hidden p-5", className)}>
      <OfferingCoverImage
        imageUrl={form.imageUrl}
        category="service"
        alt={form.name || "Service cover"}
        className="mb-4"
      />
      <div className="flex items-start justify-between gap-3">
        <OpusIconBadge icon={Briefcase} className="size-10 rounded-xl bg-primary/12" />
        <Pill tone="neutral" dot={false}>Draft</Pill>
      </div>
      <h2 className="mt-3 text-lg font-semibold">{form.name.trim() || "Untitled service"}</h2>
      <dl className="mt-4 space-y-2 border-t pt-4 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <dt className="inline-flex items-center gap-1.5 text-muted-foreground">
              <row.icon className="size-3.5" aria-hidden />
              {row.label}
            </dt>
            <dd
              className={cn(
                "truncate font-medium tabular-nums",
                row.set ? "text-foreground" : "text-muted-foreground",
              )}
              title={row.value}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
