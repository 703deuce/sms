"use client";

import { CalendarPlus, Plus } from "lucide-react";

export default function EmptyState({ onNewType }: { onNewType: () => void }) {
  return (
    <div className="panel">
      <div className="px-6 py-16 text-center max-w-md mx-auto">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef0fd] text-[#4f46e5]">
          <CalendarPlus size={22} />
        </div>
        <h3 className="text-[16px] font-semibold text-[#1a1d29]">No booking types yet</h3>
        <p className="text-[13.5px] text-[#667085] mt-2 leading-relaxed">
          Booking types define the services customers can schedule — duration, availability, staff,
          and price. Create your first one to start accepting bookings.
        </p>
        <button
          type="button"
          className="btn-brand inline-flex items-center gap-1.5 mt-6 h-9.5 px-4.5 rounded-lg text-[13.5px] font-semibold shadow-sm transition-all active:scale-[0.98]"
          style={{ height: 38, paddingLeft: 18, paddingRight: 18 }}
          onClick={onNewType}
        >
          <Plus size={15} strokeWidth={2.5} /> Create your first booking type
        </button>
      </div>
    </div>
  );
}
