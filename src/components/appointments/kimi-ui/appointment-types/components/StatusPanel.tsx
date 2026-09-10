"use client";

import { Copy, ExternalLink } from "lucide-react";
import type { AppointmentTypeItem } from "@/features/appointments/kimi/appointment-types/types";

interface Props {
  type: AppointmentTypeItem;
  workspaceSlug: string;
  copied: boolean;
  onToggleActive: (active: boolean) => void;
  onCopyLink: () => void;
  onViewBookingPage: () => void;
}

export default function StatusPanel({
  type,
  workspaceSlug,
  copied,
  onToggleActive,
  onCopyLink,
  onViewBookingPage,
}: Props) {
  const bookingPath = workspaceSlug
    ? `${typeof window !== "undefined" ? window.location.host : "transovo.com"}/book/${workspaceSlug}/${type.id}`
    : "Enable public booking to get a link";

  return (
    <div className="card p-5 space-y-5">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="text-[14px] font-semibold">Status</h3>
          <button
            type="button"
            className={`toggle ${type.active ? "on" : ""}`}
            aria-label="Toggle status"
            onClick={() => onToggleActive(!type.active)}
          />
        </div>
        <p className="text-[12.5px] font-medium">{type.active ? "Active" : "Inactive"}</p>
        <p className="text-[11.5px] text-[#8a8fa3] leading-snug mt-0.5">
          Active types are visible on your public booking page.
        </p>
      </div>

      <div className="border-t border-[#ecedf2] pt-4">
        <h3 className="text-[14px] font-semibold mb-2">Booking link</h3>
        <div className="flex items-center gap-1.5 border border-[#e4e6ee] rounded-lg px-3 py-2 bg-[#f7f8fa]">
          <span className="flex-1 text-[12px] text-[#147d74] font-medium truncate">{bookingPath}</span>
          <button type="button" className="text-[#a0a3b5] hover:text-[#147d74]" onClick={onCopyLink}>
            <Copy size={13} />
          </button>
          <button type="button" className="text-[#a0a3b5] hover:text-[#147d74]" onClick={onViewBookingPage}>
            <ExternalLink size={13} />
          </button>
        </div>
        <p className="text-[11.5px] text-[#8a8fa3] mt-1.5">
          {copied ? "Link copied to clipboard." : "Share your booking page to start getting booked."}
        </p>
      </div>

      <div className="border-t border-[#ecedf2] pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-[#8a8fa3]">Created</span>
          <span className="text-[12px] text-[#3f4254]">{type.created}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-[#8a8fa3]">Updated</span>
          <span className="text-[12px] text-[#3f4254]">{type.updated}</span>
        </div>
      </div>
    </div>
  );
}
