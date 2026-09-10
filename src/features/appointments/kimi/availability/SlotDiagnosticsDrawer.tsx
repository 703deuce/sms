"use client";

import { useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { SlotDiagnosticsPanel } from "@/features/appointments/kimi/availability/SlotDiagnosticsPanel";
import type { SlotDiagnosticsContext, SlotDiagnosticsStaffOption } from "@/features/appointments/kimi/availability/slot-diagnostics-types";

type Props = {
  open: boolean;
  onClose: () => void;
  context?: SlotDiagnosticsContext;
  staffOptions?: SlotDiagnosticsStaffOption[];
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  onOpenFullPage?: () => void;
};

export function SlotDiagnosticsDrawer({
  open,
  onClose,
  context,
  staffOptions,
  returnFocusRef,
  onOpenFullPage,
}: Props) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  const handleClose = useCallback(() => {
    onClose();
    const target = returnFocusRef?.current ?? previousFocusRef.current;
    window.setTimeout(() => target?.focus(), 0);
  }, [onClose, returnFocusRef]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, handleClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={handleClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-[#ecedf2] bg-white shadow-xl sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="slot-diagnostics-drawer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#ecedf2] px-5 py-4">
          <div>
            <h2 id="slot-diagnostics-drawer-title" className="text-[15px] font-bold text-[#1a1830]">
              Check availability
            </h2>
            <p className="text-[12px] text-[#8a87a0] mt-0.5">
              Diagnose why a time is or is not bookable without leaving your current work.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="rounded-lg border border-[#e4e6ee] p-2 text-[#6b6f82] hover:bg-[#f7f8fb]"
            onClick={handleClose}
            aria-label="Close availability diagnostics"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          <SlotDiagnosticsPanel
            context={context}
            staffOptions={staffOptions}
            variant="drawer"
            onOpenFullPage={onOpenFullPage}
          />
        </div>
      </div>
    </div>
  );
}
