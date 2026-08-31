"use client";

import { useState } from "react";
import { X, PenLine } from "lucide-react";
import { formTemplates } from "../mock-data";

export default function TemplatesModal({
  formType, onClose, onApply,
}: {
  formType: "landing" | "embed";
  onClose: () => void;
  onApply: () => void;
}) {
  const [tab, setTab] = useState<"all" | "landing" | "embed">("all");
  const [loading, setLoading] = useState(false);
  const tabs = [
    { k: "all", l: "All Templates" },
    { k: "landing", l: "Landing Page" },
    { k: "embed", l: "Website Embed" },
  ] as const;

  const pick = () => {
    setLoading(true);
    setTimeout(onApply, 700);
  };

  return (
    <div className="tv-modal-overlay" onClick={onClose}>
      <div
        className="tv-modal flex h-[80vh] w-[min(1100px,92vw)] flex-col rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold text-gray-900">Form Templates</h2>
            <p className="mt-0.5 max-w-[720px] text-[12px] text-gray-500">
              Select a template to quickly build a form. All templates can be used as either a landing page or website embed however each is optimized for a specific type.
            </p>
          </div>
          <button className="tv-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="flex items-center gap-5 border-b border-gray-100 px-6">
          {tabs.map((t) => (
            <button
              key={t.k}
              className={`border-b-2 py-2.5 text-[13px] font-semibold ${tab === t.k ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-800"}`}
              onClick={() => setTab(t.k)}
            >
              {t.l}
            </button>
          ))}
        </div>
        <div className="tv-scroll flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-indigo-600 border-t-transparent" />
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-5">
              <button
                className="flex min-h-[190px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/30 text-indigo-600 hover:bg-indigo-50"
                onClick={pick}
              >
                <PenLine size={20} />
                <span className="text-[13px] font-bold">Start From Scratch</span>
                <span className="px-4 text-center text-[11px] font-normal text-gray-500">
                  Begin with a blank canvas to design a fully customized web form.
                </span>
              </button>
              {formTemplates.map((t) => (
                <button key={t.id} className="group text-left" onClick={pick}>
                  <div
                    className="relative mb-2 h-[120px] overflow-hidden rounded-lg border border-gray-200 transition-shadow group-hover:shadow-md"
                    style={{ background: `linear-gradient(135deg, hsl(${t.hue},45%,88%), hsl(${t.hue},50%,72%))` }}
                  >
                    <div className="absolute left-3 top-3 h-2 w-16 rounded bg-white/80" />
                    <div className="absolute left-3 top-7 h-1.5 w-24 rounded bg-white/60" />
                    <div className="absolute bottom-3 left-3 right-3 space-y-1.5">
                      <div className="h-4 rounded bg-white/90" />
                      <div className="h-4 rounded bg-white/90" />
                      <div className="h-4 w-2/3 rounded" style={{ background: `hsl(${t.hue},60%,45%)` }} />
                    </div>
                  </div>
                  <div className="text-[12px] font-bold text-gray-900">{t.name}</div>
                  <div className="mt-0.5 text-[10px] leading-snug text-gray-500">{t.desc}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
