"use client";

import { Copy, Check, ExternalLink, Globe } from "lucide-react";
import type { AppointmentTypeItem } from "../mock-data";

type Props = {
  type: AppointmentTypeItem;
  bookingBaseUrl: string;
  copied: boolean;
  onToggleActive: (active: boolean) => void;
  onCopyLink: () => void;
  onOpenPage: () => void;
};

export default function StatusPanel({ type, bookingBaseUrl, copied, onToggleActive, onCopyLink, onOpenPage }: Props) {
  const bookingUrl = `${bookingBaseUrl}/${type.slug}`;

  return (
    <div className="panel">
      <div className="px-4 py-3 border-b border-[#ecedf2]">
        <h3 className="text-[13px] font-semibold text-[#1a1d29]">Status &amp; sharing</h3>
      </div>
      <div className="px-4 py-4 space-y-4">
        {/* Active toggle */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-[#3c4257]">Accepting bookings</div>
            <div className="text-[12px] text-[#8a8fa3] mt-0.5">
              {type.active ? "Visible on your booking page." : "Paused — hidden from customers."}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={type.active}
            aria-label="Accepting bookings"
            className="toggle"
            onClick={() => onToggleActive(!type.active)}
          />
        </div>

        <hr className="section-divider !my-3" />

        {/* Public link */}
        <div>
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#3c4257] mb-2">
            <Globe size={12.5} className="text-[#8a8fa3]" /> Public booking link
          </div>
          <div className="rounded-lg border border-[#e4e6ee] bg-[#f7f8fb] px-3 py-2 text-[12px] text-[#667085] truncate" title={bookingUrl}>
            {bookingUrl}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2.5">
            <button
              type="button"
              className="btn-secondary flex items-center justify-center gap-1.5 h-8.5 rounded-lg text-[12.5px] font-medium"
              onClick={onCopyLink}
            >
              {copied ? (
                <>
                  <Check size={13} className="text-[#067647]" /> Copied
                </>
              ) : (
                <>
                  <Copy size={13} className="text-[#8a8fa3]" /> Copy link
                </>
              )}
            </button>
            <button
              type="button"
              className="btn-secondary flex items-center justify-center gap-1.5 h-8.5 rounded-lg text-[12.5px] font-medium"
              onClick={onOpenPage}
              disabled={!type.isLive}
              title={type.isLive ? "Preview this booking page" : "Activate this type to open its page"}
            >
              Open page <ExternalLink size={12} className="text-[#8a8fa3]" />
            </button>
          </div>
        </div>

        <hr className="section-divider !my-3" />

        {/* Facts */}
        <dl className="space-y-2.5 text-[12.5px]">
          <div className="flex items-center justify-between">
            <dt className="text-[#8a8fa3]">Status</dt>
            <dd>
              <span className={`chip ${type.isLive ? "chip-live" : type.active ? "chip-draft" : "chip-paused"}`}>
                {type.isLive ? "Live" : type.active ? "Not published" : "Paused"}
              </span>
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[#8a8fa3]">Duration</dt>
            <dd className="font-medium text-[#3c4257]">{type.durationMin} minutes</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[#8a8fa3]">Price</dt>
            <dd className="font-medium text-[#3c4257]">{type.free ? "Free" : `$${type.price}`}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[#8a8fa3]">Buffer</dt>
            <dd className="font-medium text-[#3c4257]">{type.bufferMin === 0 ? "None" : `${type.bufferMin} min`}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[#8a8fa3]">Questions</dt>
            <dd className="font-medium text-[#3c4257]">{type.questions.length === 0 ? "None" : `${type.questions.length} custom`}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
