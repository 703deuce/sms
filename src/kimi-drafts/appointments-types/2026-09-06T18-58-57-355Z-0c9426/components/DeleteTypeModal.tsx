"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

type Props = {
  typeName: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function DeleteTypeModal({ typeName, onCancel, onConfirm }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="modal-scrim" role="presentation" onClick={onCancel}>
      <div
        className="modal-card animate-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-type-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fef3f2] text-[#d92d20] shrink-0">
            <AlertTriangle size={18} />
          </div>
          <button
            type="button"
            className="p-1.5 rounded-md text-[#a7abb9] hover:bg-[#f2f4f7] hover:text-[#3c4257]"
            onClick={onCancel}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 pb-5 pt-3">
          <h3 id="delete-type-title" className="text-[15px] font-semibold text-[#1a1d29]">
            Delete &ldquo;{typeName}&rdquo;?
          </h3>
          <p className="text-[13px] text-[#667085] mt-2 leading-relaxed">
            This permanently removes the booking type and its configuration. Its public booking page
            will stop accepting new appointments immediately.
          </p>
          <p className="text-[13px] text-[#667085] mt-2 leading-relaxed">
            Existing appointments already on your calendar are <strong className="font-semibold text-[#3c4257]">not</strong> affected
            and will remain scheduled.
          </p>
          <div className="flex items-center justify-end gap-2.5 mt-5">
            <button
              ref={cancelRef}
              type="button"
              className="btn-secondary h-9 px-4 rounded-lg text-[13px] font-medium"
              onClick={onCancel}
            >
              Keep booking type
            </button>
            <button
              type="button"
              className="h-9 px-4 rounded-lg text-[13px] font-semibold bg-[#d92d20] text-white shadow-sm hover:bg-[#b42318] transition-colors active:scale-[0.98]"
              onClick={onConfirm}
            >
              Delete booking type
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
