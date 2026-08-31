"use client";

import { HelpCircle } from "lucide-react";

export function RemoveFieldModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="tv-modal-overlay" onClick={onCancel}>
      <div
        className="tv-modal w-[min(420px,92vw)] rounded-xl bg-white p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
            <HelpCircle size={26} className="text-indigo-600" />
          </div>
          <h2 className="mt-3 text-[17px] font-bold text-gray-900">Remove Field?</h2>
          <p className="mt-1 text-[13px] text-gray-500">Are you sure you want to remove this field element?</p>
        </div>
        <div className="mt-6 flex justify-center gap-3">
          <button className="tv-btn-primary !px-8" onClick={onConfirm}>Yes</button>
          <button className="tv-btn-ghost !px-8" onClick={onCancel}>No</button>
        </div>
      </div>
    </div>
  );
}
