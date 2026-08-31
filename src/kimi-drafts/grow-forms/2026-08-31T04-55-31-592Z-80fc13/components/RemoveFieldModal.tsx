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
        <HelpCircle size={32} className="mx-auto text-indigo-500 mb-3" />
        <h3 className="text-base font-semibold text-foreground mb-1">Remove Field?</h3>
        <p className="text-sm text-muted-foreground mb-5">Are you sure you want to remove this field element?</p>
        <div className="flex gap-3">
          <button onClick={onConfirm} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 rounded-md">Yes</button>
          <button onClick={onClose} className="flex-1 border border-border text-sm font-medium py-2 rounded-md hover:bg-muted">No</button>
        </div>
      </div>
    </Modal>
  );
}
