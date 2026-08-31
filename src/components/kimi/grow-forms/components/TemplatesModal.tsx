"use client";
import React, { useState } from "react";
import { Rocket } from "lucide-react";
import { Modal } from "./ui";
import { templates } from "../mock-data";

export default function TemplatesModal({
  open, onClose, onPick,
}: { open: boolean; onClose: () => void; onPick: (id: string) => void }) {
  const [tab, setTab] = useState<"all" | "landing" | "embed">("all");
  const shown = templates.filter((t) => tab === "all" ? true : tab === "landing" ? t.kind === "landing" : t.kind === "embed");

  return (
    <Modal open={open} onClose={onClose} width={920}>
      <div className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">Form Templates</h2>
        <p className="text-sm text-muted-foreground mb-4">Select a template to quickly build a form. All templates can be used as either a landing page or website embed however each is optimized for a specific type.</p>
        <div className="flex gap-5 border-b border-border mb-5 text-sm">
          {([["all", "All Templates"], ["landing", "Landing Page"], ["embed", "Website Embed"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`pb-2 -mb-px ${tab === k ? "border-b-2 border-indigo-600 text-indigo-600 font-medium" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 tv-scroll overflow-auto" style={{ maxHeight: "52vh" }}>
          {shown.map((t) => (
            <div key={t.id} className="tv-tpl-card border border-border rounded-lg overflow-hidden bg-card" onClick={() => onPick(t.id)}>
              <div className={`tv-tpl-thumb tv-tpl-thumb-${t.bg}`}>
                {t.bg === "blank" && (
                  <span className="flex flex-col items-center gap-2 text-indigo-600">
                    <Rocket size={22} />
                    <span className="text-xs font-medium">Start From Scratch</span>
                  </span>
                )}
              </div>
              <div className="p-3">
                <div className="text-xs font-semibold text-foreground mb-1">{t.title}</div>
                <div className="text-[11px] text-muted-foreground leading-snug">{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
