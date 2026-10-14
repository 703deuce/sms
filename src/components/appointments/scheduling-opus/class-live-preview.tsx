"use client";

import type { LucideIcon } from "lucide-react";
import { CalendarDays, MapPin, Repeat, Tag, UserRound, Users, Wallet } from "lucide-react";
import type { ClassFormState } from "@/lib/appointments/classes/class-form";
import { classPriceLabel } from "@/lib/appointments/classes/class-summary";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { OpusIconBadge, Pill } from "@/newui-transplant/components/app/kit";
import { cn } from "@/lib/utils";
import { OfferingCoverImage } from "./offering-cover-image";

type Props = {
  form: ClassFormState;
  staffNames: Map<string, string>;
  locationNames: Map<string, string>;
  sessionCount: number;
  className?: string;
};

export function ClassLivePreview({
  form,
  staffNames,
  locationNames,
  sessionCount,
  className,
}: Props) {
  const rows: Array<{ icon: LucideIcon; label: string; value: string; set: boolean }> = [
    { icon: Tag, label: "Category", value: form.category || "None", set: Boolean(form.category) },
    {
      icon: Repeat,
      label: "Pattern",
      value: form.recurrence.startDate
        ? `${form.recurrence.pattern === "one_time" ? "One-time" : "Repeating"} · ${sessionCount} session${sessionCount === 1 ? "" : "s"}`
        : "Not set",
      set: Boolean(form.recurrence.startDate),
    },
    {
      icon: UserRound,
      label: "Instructor",
      value: form.staffId ? staffNames.get(form.staffId) || "Assigned" : "Unassigned",
      set: Boolean(form.staffId),
    },
    {
      icon: MapPin,
      label: "Location",
      value: form.locationId ? locationNames.get(form.locationId) || "Assigned" : "Not set",
      set: Boolean(form.locationId),
    },
    { icon: Users, label: "Seats", value: `${form.capacity} per session`, set: form.capacity > 0 },
    { icon: Wallet, label: "Price", value: classPriceLabel(form), set: true },
  ];

  return (
    <section className={cn(OPUS_CARD, "overflow-hidden p-5", className)}>
      <OfferingCoverImage
        imageUrl={form.imageUrl}
        category={form.requireFullSeries ? "course" : "class"}
        alt={form.name || "Class cover"}
        preview
        className="mb-4"
      />
      <div className="flex items-start justify-between gap-3">
        <OpusIconBadge icon={CalendarDays} className="size-10 rounded-xl bg-primary/12" />
        <Pill tone="neutral" dot={false}>Draft</Pill>
      </div>
      <h2 className="mt-3 text-lg font-semibold">{form.name.trim() || "Untitled class"}</h2>
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
