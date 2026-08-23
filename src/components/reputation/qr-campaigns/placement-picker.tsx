"use client";

import {
  Car,
  CreditCard,
  FileText,
  Link2,
  Mail,
  Monitor,
  Receipt,
  Store,
  StickyNote,
  Wrench,
  PanelsTopLeft,
  type LucideIcon,
} from "lucide-react";
import {
  QR_PLACEMENT_LABELS,
  type QrPlacementType,
} from "@/lib/reputation/qr-campaigns/types";
import { cn } from "@/lib/utils";

/** Visual placement choices — icons, not emoji (matches app design language). */
export const PLACEMENT_PICKER_OPTIONS: {
  type: QrPlacementType;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  {
    type: "front_desk",
    label: "Front Desk Poster",
    hint: "Lobby / check-in",
    icon: Store,
  },
  {
    type: "standard_poster",
    label: "Standard Poster",
    hint: "Wall or stand",
    icon: PanelsTopLeft,
  },
  {
    type: "receipt_insert",
    label: "Receipt Insert",
    hint: "With the bill",
    icon: Receipt,
  },
  {
    type: "business_card",
    label: "Business Card",
    hint: "Handout size",
    icon: CreditCard,
  },
  {
    type: "company_vehicle",
    label: "Vehicle Sticker",
    hint: "Trucks & vans",
    icon: Car,
  },
  {
    type: "window_sign",
    label: "Window Sticker",
    hint: "Storefront glass",
    icon: Monitor,
  },
  {
    type: "email_signature",
    label: "Email Link",
    hint: "Signature / PDF",
    icon: Mail,
  },
  {
    type: "counter_sign",
    label: "Counter Sign",
    hint: "Point of sale",
    icon: StickyNote,
  },
  {
    type: "table_tent",
    label: "Table Tent",
    hint: "Tables & booths",
    icon: FileText,
  },
  {
    type: "technician_leave_behind",
    label: "Leave-behind",
    hint: "After service",
    icon: Wrench,
  },
  {
    type: "invoice",
    label: "Invoice",
    hint: "Billing docs",
    icon: FileText,
  },
  {
    type: "custom",
    label: "Custom",
    hint: "Your own label",
    icon: Link2,
  },
];

export function PlacementPicker({
  value,
  onChange,
  className,
}: {
  value: QrPlacementType;
  onChange: (type: QrPlacementType) => void;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {PLACEMENT_PICKER_OPTIONS.map((opt) => {
        const selected = value === opt.type;
        const Icon = opt.icon;
        return (
          <button
            key={opt.type}
            type="button"
            onClick={() => onChange(opt.type)}
            className={cn(
              "flex items-start gap-3 rounded-2xl border px-3.5 py-3.5 text-left transition",
              selected
                ? "border-[#16A34A] bg-[#ECFDF3] shadow-[0_0_0_1px_#16A34A]"
                : "border-[#E6EAF0] bg-white hover:border-[#A6F4C5] hover:bg-[#F9FAFB]"
            )}
          >
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                selected ? "bg-[#16A34A] text-white" : "bg-[#F2F4F7] text-[#475467]"
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-[#0B1B32]">
                {opt.label || QR_PLACEMENT_LABELS[opt.type]}
              </span>
              <span className="mt-0.5 block text-xs text-[#667085]">{opt.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
