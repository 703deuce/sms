"use client";

import type { LucideIcon } from "lucide-react";
import { CalendarDays, Globe, MapPin, Presentation, Tag, UserRound, Users, Wallet } from "lucide-react";
import type { WorkshopFormState } from "@/lib/appointments/workshops/workshop-form";
import { workshopPriceLabel } from "@/lib/appointments/workshops/workshop-summary";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { OpusIconBadge, Pill } from "@/newui-transplant/components/app/kit";
import { cn } from "@/lib/utils";
import { OfferingCoverImage } from "./offering-cover-image";

type Props = {
  form: WorkshopFormState;
  staffNames: Map<string, string>;
  locationNames: Map<string, string>;
  sessionLabel: string;
  className?: string;
};

export function WorkshopLivePreview({
  form,
  staffNames,
  locationNames,
  sessionLabel,
  className,
}: Props) {
  const rows: Array<{ icon: LucideIcon; label: string; value: string; set: boolean }> = [
    { icon: Tag, label: "Category", value: form.category || "None", set: Boolean(form.category) },
    {
      icon: CalendarDays,
      label: "When",
      value: sessionLabel || "Not set",
      set: Boolean(sessionLabel),
    },
    {
      icon: UserRound,
      label: "Host",
      value: form.staffId ? staffNames.get(form.staffId) || "Assigned" : "Unassigned",
      set: Boolean(form.staffId),
    },
    {
      icon: form.locationMode === "virtual" ? Globe : MapPin,
      label: "Where",
      value:
        form.locationMode === "virtual"
          ? "Online"
          : form.locationId
            ? locationNames.get(form.locationId) || "Assigned"
            : "Not set",
      set: form.locationMode === "virtual" || Boolean(form.locationId),
    },
    { icon: Users, label: "Capacity", value: `${form.capacity} seats`, set: form.capacity > 0 },
    { icon: Wallet, label: "Price", value: workshopPriceLabel(form), set: true },
  ];

  return (
    <section className={cn(OPUS_CARD, "overflow-hidden p-5", className)}>
      <OfferingCoverImage
        imageUrl={form.imageUrl}
        category="workshop"
        alt={form.name || "Workshop cover"}
        className="mb-4"
      />
      <div className="flex items-start justify-between gap-3">
        <OpusIconBadge icon={Presentation} className="size-10 rounded-xl bg-primary/12" />
        <Pill tone="neutral" dot={false}>Draft</Pill>
      </div>
      <h2 className="mt-3 text-lg font-semibold">{form.name.trim() || "Untitled workshop"}</h2>
      <dl className="mt-4 space-y-2 border-t pt-4 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <dt className="inline-flex items-center gap-1.5 text-muted-foreground">
              <row.icon className="size-3.5" aria-hidden />
              {row.label}
            </dt>
            <dd
              className={cn(
                "truncate font-medium",
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
