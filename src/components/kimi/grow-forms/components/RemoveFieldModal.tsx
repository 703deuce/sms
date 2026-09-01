"use client";
import React from "react";
import { HelpCircle } from "lucide-react";
import { Modal } from "./ui";

export default function RemoveFieldModal({
  open, onClose, onConfirm,
}: { open: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal open={open} onClose={onClose} width={360}>
      <div className="p-7 text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/15">
          <HelpCircle size={22} className="text-primary" />
        </div>
        <h3 className="mb-1.5 font-display text-base font-semibold tracking-tight text-foreground">Remove Field?</h3>
        <p className="mb-6 text-[13px] leading-relaxed text-muted-foreground">Are you sure you want to remove this field element?</p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          >
            Yes
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border bg-card py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          >
            No
          </button>
        </div>
      </div>
    </Modal>
  );
}
