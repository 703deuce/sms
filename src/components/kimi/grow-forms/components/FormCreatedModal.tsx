"use client";
import React from "react";
import { CheckCircle2, Copy } from "lucide-react";
import { Modal } from "./ui";

export default function FormCreatedModal({
  open, onClose, type, url, embedCode,
}: { open: boolean; onClose: () => void; type: "landing" | "embed"; url: string; embedCode: string }) {
  return (
    <Modal open={open} onClose={onClose} width={440}>
      <div className="p-6 text-center">
        <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-3" />
        <h3 className="text-lg font-semibold text-foreground mb-1">Form Created</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {type === "landing"
            ? "Your form has been successfully created."
            : "Your form has been successfully created. You can paste its embed code into any page of the website where you want it to show."}
        </p>
        <div className="text-left mb-5">
          <div className="text-xs font-medium text-foreground mb-1">{type === "landing" ? "Form URL" : "Form Embed Code"}</div>
          <div className="flex items-center gap-2 border border-border rounded-md px-3 py-2 bg-muted/40">
            <code className="text-xs text-muted-foreground truncate flex-1">
              {type === "landing" ? url : embedCode}
            </code>
            <Copy size={14} className="text-muted-foreground cursor-pointer hover:text-foreground flex-none" />
          </div>
        </div>
        <div className="flex gap-3">
          <button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 rounded-md">
            {type === "landing" ? "View Form" : "Copy Embed Code"}
          </button>
          <button onClick={onClose} className="flex-1 border border-border text-sm font-medium py-2 rounded-md hover:bg-muted">Close</button>
        </div>
      </div>
    </Modal>
  );
}
