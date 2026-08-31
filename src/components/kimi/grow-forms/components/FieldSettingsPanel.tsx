"use client";
import React from "react";
import { ArrowLeft, ChevronRight, Search } from "lucide-react";
import { contactFields } from "../mock-data";

const categories = ["Text", "Size & Spacing", "Border", "Background", "Shadow", "Opacity", "Visibility", "Custom CSS"];

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
      <button onClick={onBack} className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"><ArrowLeft size={12} /> Back</button>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="text-[11px] text-muted-foreground">Below are all of the settings for this element. Expand each settings category to reveal all of its available options.</p>

      {kind === "field" && (
        <div className="border border-border rounded-lg">
          <div className="px-3 py-2 text-xs font-medium border-b border-border bg-muted/40">Field</div>
          <div className="p-3 space-y-2.5">
            <label className="text-[11px] text-muted-foreground">Contact Field</label>
            <select className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background">
              {contactFields.map((f) => <option key={f} selected={f === "Email"}>{f}</option>)}
            </select>
            <label className="text-[11px] text-muted-foreground">Placeholder Text</label>
            <input value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
            <label className="text-[11px] text-muted-foreground">Default Value</label>
            <input className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background" />
            <label className="text-[11px] text-muted-foreground">Keyboard On Mobile</label>
            <select className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background"><option>Standard</option><option>Email</option><option>Phone</option></select>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-muted-foreground">Required</span>
              <span className="w-9 h-5 rounded-full bg-slate-300 relative"><span className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow" /></span>
            </div>
          </div>
        </div>
      )}

      {kind === "column" && (
        <div className="border border-border rounded-lg">
          <div className="px-3 py-2 text-xs font-medium border-b border-border bg-muted/40">Background</div>
          <div className="p-3 space-y-2.5">
            <label className="text-[11px] text-muted-foreground">Background Color</label>
            <div className="h-8 rounded border border-border bg-[repeating-conic-gradient(#e2e8f0_0_25%,#fff_0_50%)] bg-[length:12px_12px]" />
            <label className="text-[11px] text-muted-foreground">Background Image</label>
            <button onClick={onOpenImages} className="flex items-center gap-1.5 text-xs border border-border rounded-md px-3 py-1.5 hover:bg-muted"><Search size={12} /> Search</button>
            <label className="text-[11px] text-muted-foreground">Background Image Size</label>
            <select className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background"><option>Cover</option><option>Contain</option></select>
            {["Background Image Position - Vertical", "Background Image Position - Horizontal"].map((l) => (
              <div key={l}>
                <div className="flex justify-between text-[11px] text-muted-foreground"><span>{l}</span><span>50%</span></div>
                <div className="h-1.5 rounded bg-slate-200 mt-1"><div className="h-full w-1/2 bg-indigo-500 rounded" /></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {kind !== "column" && kind !== "field" && (
        <div className="border border-border rounded-lg">
          <div className="px-3 py-2 text-xs font-medium border-b border-border bg-muted/40">Text</div>
          <div className="p-3 space-y-2.5">
            <input defaultValue={kind === "header" ? "Want 20% Off?" : "Join Now"} className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background" />
            <div className="flex gap-1">
              {["B", "I", "U", "S", "🔗", "🕐", "⚙", "★"].map((b, i) => (
                <button key={i} className="w-7 h-7 text-xs border border-border rounded hover:bg-muted">{b}</button>
              ))}
            </div>
            <label className="text-[11px] text-muted-foreground">Font</label>
            <select className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background">
              <option>Cormorant Garamond</option><option>Arial</option><option>Sans Serif</option><option>Serif</option><option>DM Sans</option>
            </select>
            <label className="text-[11px] text-muted-foreground">Text Size</label>
            <div className="h-1.5 rounded bg-slate-200"><div className="h-full w-1/3 bg-indigo-500 rounded" /></div>
          </div>
        </div>
      )}

      <div className="border border-border rounded-lg divide-y divide-border">
        {categories.map((c) => (
          <button key={c} className="w-full flex items-center justify-between px-3 py-2 text-xs text-foreground hover:bg-muted/50">
            {c} <ChevronRight size={13} className="text-muted-foreground" />
          </button>
        ))}
      </div>

      {kind === "field" && (
        <button onClick={onRemove} className="w-full text-xs text-red-600 border border-red-200 rounded-md py-2 hover:bg-red-50">Remove Field</button>
      )}
    </div>
  );
}
