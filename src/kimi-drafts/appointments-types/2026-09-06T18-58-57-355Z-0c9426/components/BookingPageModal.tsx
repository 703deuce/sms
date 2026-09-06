"use client";

import { useEffect, useRef } from "react";
import { X, Copy, Check, ExternalLink } from "lucide-react";
import type { AppointmentTypeItem } from "../mock-data";
import PreviewPanel from "./PreviewPanel";

type Props = {
  type: AppointmentTypeItem | null;
  bookingBaseUrl: string;
  onClose: () => void;
};

export default function BookingPageModal({ type, bookingBaseUrl, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const url = type ? `${bookingBaseUrl}/${type.slug}` : bookingBaseUrl;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-scrim" role="presentation" onClick={onClose}>
      <div
        className="modal-card modal-card-lg animate-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-page-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#ecedf2]">
          <div className="min-w-0">
            <h3 id="booking-page-title" className="text-[15px] font-semibold text-[#1a1d29]">
              Your public booking page
            </h3>
            <p className="text-[12px] text-[#8a8fa3] mt-0.5 truncate">{url}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={`https://${url}`}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary flex items-center gap-1.5 h-8.5 px-3.5 rounded-lg text-[12.5px] font-medium"
              style={{ height: 34 }}
            >
              Open live page <ExternalLink size={12.5} className="text-[#8a8fa3]" />
            </a>
            <button
              ref={closeRef}
              type="button"
              className="p-1.5 rounded-md text-[#a7abb9] hover:bg-[#f2f4f7] hover:text-[#3c4257]"
              onClick={onClose}
              aria-label="Close preview"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="p-5 bg-[#f7f8fb] max-h-[70vh] overflow-y-auto">
          {type ? (
            <PreviewPanel type={type} />
          ) : (
            <p className="text-[13px] text-[#667085] text-center py-8">
              Select a booking type to preview its booking page.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
