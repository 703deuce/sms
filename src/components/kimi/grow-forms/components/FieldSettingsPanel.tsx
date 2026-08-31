"use client";
import React from "react";
import { ArrowLeft, ChevronRight, Search } from "lucide-react";
import { contactFields } from "../mock-data";

const categories = ["Text", "Size & Spacing", "Border", "Background", "Shadow", "Opacity", "Visibility", "Custom CSS"];

const panelInput =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground transition-shadow focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25";

function PanelGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="space-y-2.5 p-3">{children}</div>
    </div>
  );
}

function PanelLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-medium text-muted-foreground">{children}</label>;
}

export function FieldSettingsPanel({
  kind, onBack, placeholder, setPlaceholder, onOpenImages, onRemove,
}: {
  kind: "field" | "column" | "header" | "button";
  onBack: () => void;
  placeholder: string;
  setPlaceholder: (v: string) => void;
  onOpenImages: () => void;
  onRemove: () => void;
}) {
  const title = kind === "column" ? "Column Settings" : kind === "header" ? "Header Settings" : kind === "button" ? "Button Settings" : "Field Settings";
  return (
    <div className="space-y-3">
      <button onClick={onBack} className="flex items-center gap-1 text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-700 hover:underline">
        <ArrowLeft size={12} /> Back
      </button>
      <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Below are all of the settings for this element. Expand each settings category to reveal all of its available options.
      </p>

      {kind === "field" && (
        <PanelGroup title="Field">
          <div>
            <PanelLabel>Contact Field</PanelLabel>
            <select className={panelInput} defaultValue="Email">
              {contactFields.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <PanelLabel>Placeholder Text</PanelLabel>
            <input value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} className={panelInput} />
          </div>
          <div>
            <PanelLabel>Default Value</PanelLabel>
            <input className={panelInput} />
          </div>
          <div>
            <PanelLabel>Keyboard On Mobile</PanelLabel>
            <select className={panelInput}><option>Standard</option><option>Email</option><option>Phone</option></select>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] font-medium text-muted-foreground">Required</span>
            <span className="relative h-5 w-9 rounded-full bg-slate-300">
              <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm" />
            </span>
          </div>
        </PanelGroup>
      )}

      {kind === "column" && (
        <PanelGroup title="Background">
          <div>
            <PanelLabel>Background Color</PanelLabel>
            <div className="h-8 rounded-md border border-border bg-[repeating-conic-gradient(#e2e8f0_0_25%,#fff_0_50%)] bg-[length:12px_12px]" />
          </div>
          <div>
            <PanelLabel>Background Image</PanelLabel>
            <button
              onClick={onOpenImages}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Search size={12} /> Search
            </button>
          </div>
          <div>
            <PanelLabel>Background Image Size</PanelLabel>
            <select className={panelInput}><option>Cover</option><option>Contain</option></select>
          </div>
          {["Background Image Position - Vertical", "Background Image Position - Horizontal"].map((l) => (
            <div key={l}>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{l}</span>
                <span className="font-medium text-foreground">50%</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-slate-200">
                <div className="h-full w-1/2 rounded-full bg-indigo-500" />
              </div>
            </div>
          ))}
        </PanelGroup>
      )}

      {kind !== "column" && kind !== "field" && (
        <PanelGroup title="Text">
          <input defaultValue={kind === "header" ? "Want 20% Off?" : "Join Now"} className={panelInput} />
          <div className="flex gap-1">
            {["B", "I", "U", "S", "🔗", "🕐", "⚙", "★"].map((b, i) => (
              <button
                key={i}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {b}
              </button>
            ))}
          </div>
          <div>
            <PanelLabel>Font</PanelLabel>
            <select className={panelInput}>
              <option>Cormorant Garamond</option><option>Arial</option><option>Sans Serif</option><option>Serif</option><option>DM Sans</option>
            </select>
          </div>
          <div>
            <PanelLabel>Text Size</PanelLabel>
            <div className="mt-1.5 h-1.5 rounded-full bg-slate-200">
              <div className="h-full w-1/3 rounded-full bg-indigo-500" />
            </div>
          </div>
        </PanelGroup>
      )}

      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {categories.map((c) => (
          <button
            key={c}
            className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/40"
          >
            {c}
            <ChevronRight size={13} className="text-muted-foreground" />
          </button>
        ))}
      </div>

      {kind === "field" && (
        <button
          onClick={onRemove}
          className="w-full rounded-md border border-red-200 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          Remove Field
        </button>
      )}
    </div>
  );
}
