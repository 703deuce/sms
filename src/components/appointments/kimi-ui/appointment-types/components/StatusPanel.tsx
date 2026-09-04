"use client";
import { Copy, ExternalLink } from "lucide-react";
import { AppointmentType } from "../mock-data";

interface Props {
  type: AppointmentType;
}

export default function StatusPanel({ type }: Props) {
  return (
    <div className="card p-5 space-y-5">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="text-[14px] font-semibold">Status</h3>
          <button className={`toggle ${type.active ? "on" : ""}`} aria-label="Toggle status" />
        </div>
        <p className="text-[12.5px] font-medium">{type.active ? "Active" : "Inactive"}</p>
        <p className="text-[11.5px] text-[#8a8fa3] leading-snug mt-0.5">
          Active types are visible on your public booking page.
        </p>
      </div>

      <div className="border-t border-[#ecedf2] pt-4">
        <h3 className="text-[14px] font-semibold mb-2">Booking link</h3>
        <div className="flex items-center gap-1.5 border border-[#e4e6ee] rounded-lg px-3 py-2 bg-[#f7f8fb]">
          <span className="flex-1 text-[12px] text-[#5b4bff] font-medium truncate">
            transovo.com/book/{type.slug}
          </span>
          <button className="text-[#a0a3b5] hover:text-[#5b4bff]"><Copy size={13} /></button>
          <button className="text-[#a0a3b5] hover:text-[#5b4bff]"><ExternalLink size={13} /></button>
        </div>
        <p className="text-[11.5px] text-[#8a8fa3] mt-1.5">
          Share your booking page to start getting booked.
        </p>
      </div>

      <div className="border-t border-[#ecedf2] pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-[#8a8fa3]">Created</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-[#3f4254]">{type.created}</span>
          <span className="w-7 h-7 rounded-full bg-[#eef0ff] text-[#5b4bff] text-[10px] font-bold flex items-center justify-center">MT</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-[#8a8fa3]">Updated</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-[#3f4254]">{type.updated}</span>
          <span className="w-7 h-7 rounded-full bg-[#eef0ff] text-[#5b4bff] text-[10px] font-bold flex items-center justify-center">MT</span>
        </div>
      </div>
    </div>
  );
}
