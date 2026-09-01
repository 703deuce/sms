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
      <div className="p-7">
        <h2 className="mb-1.5 font-display text-lg font-semibold tracking-tight text-foreground">Form Templates</h2>
        <p className="mb-5 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          Select a template to quickly build a form. All templates can be used as either a landing page or website embed however each is optimized for a specific type.
        </p>
        <div className="mb-6 flex gap-6 border-b border-border text-[13px]">
          {([["all", "All Templates"], ["landing", "Landing Page"], ["embed", "Website Embed"]] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`-mb-px border-b-2 pb-2.5 font-semibold transition-colors ${tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="tv-scroll grid grid-cols-2 gap-4 overflow-auto md:grid-cols-4" style={{ maxHeight: "52vh" }}>
          {shown.map((t) => (
            <div
              key={t.id}
              className="tv-tpl-card cursor-pointer overflow-hidden rounded-xl border border-border bg-card transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              onClick={() => onPick(t.id)}
            >
              <div className={`tv-tpl-thumb tv-tpl-thumb-${t.bg}`}>
                {t.bg === "blank" && (
                  <span className="flex flex-col items-center gap-2 text-primary">
                    <Rocket size={22} />
                    <span className="text-xs font-semibold">Start From Scratch</span>
                  </span>
                )}
              </div>
              <div className="p-3.5">
                <div className="mb-1 text-xs font-semibold text-foreground">{t.title}</div>
                <div className="text-[11px] leading-snug text-muted-foreground">{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
