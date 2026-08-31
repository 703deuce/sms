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
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 size={26} className="text-emerald-500" />
        </div>
        <h3 className="mb-1 text-lg font-semibold tracking-tight text-foreground">Form Created</h3>
        <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
          {type === "landing"
            ? "Your form has been successfully created."
            : "Your form has been successfully created. You can paste its embed code into any page of the website where you want it to show."}
        </p>
        <div className="mb-5 text-left">
          <div className="mb-1.5 text-xs font-medium text-foreground">{type === "landing" ? "Form URL" : "Form Embed Code"}</div>
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
            <code className="flex-1 truncate text-xs text-muted-foreground">
              {type === "landing" ? url : embedCode}
            </code>
            <button className="flex-none rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground" aria-label="Copy">
              <Copy size={14} />
            </button>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="flex-1 rounded-md bg-indigo-600 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50">
            {type === "landing" ? "View Form" : "Copy Embed Code"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-border py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
