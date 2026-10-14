"use client";

import type { LucideIcon } from "lucide-react";
import { MapPin, Repeat, Tag, UserRound, Users, Wallet } from "lucide-react";
import type { ClassFormState } from "@/lib/appointments/classes/class-form";
import { classPriceLabel } from "@/lib/appointments/classes/class-summary";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { Pill } from "@/newui-transplant/components/app/kit";
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
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Live preview</p>
        <Pill tone="neutral" dot={false}>Draft</Pill>
      </div>
      <OfferingCoverImage
        imageUrl={form.imageUrl}
        category={form.requireFullSeries ? "course" : "class"}
        alt={form.name || "Class cover"}
        preview
        className="mb-4"
      />
      <h2 className="text-lg font-semibold leading-[1.375rem]">{form.name.trim() || "Untitled class"}</h2>
      <dl className="mt-4 space-y-0 border-t pt-4 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex min-h-7 items-center justify-between gap-3 py-0.5">
            <dt className="inline-flex shrink-0 items-center gap-1.5 text-muted-foreground">
              <row.icon className="size-3.5" aria-hidden />
              {row.label}
            </dt>
            <dd
              className={cn(
                "min-w-0 truncate text-right font-medium",
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
