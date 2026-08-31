"use client";
import React from "react";
import { HelpCircle } from "lucide-react";
import { Modal } from "./ui";

export default function RemoveFieldModal({
  open, onClose, onConfirm,
}: { open: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal open={open} onClose={onClose} width={360}>
      <div className="p-6 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50">
          <HelpCircle size={22} className="text-indigo-500" />
        </div>
        <h3 className="mb-1 text-base font-semibold tracking-tight text-foreground">Remove Field?</h3>
        <p className="mb-5 text-sm text-muted-foreground">Are you sure you want to remove this field element?</p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 rounded-md bg-indigo-600 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
          >
            Yes
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-border py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            No
          </button>
        </div>
      </div>
    </Modal>
  );
}
