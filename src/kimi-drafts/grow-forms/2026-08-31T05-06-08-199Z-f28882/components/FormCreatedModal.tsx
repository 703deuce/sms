"use client";

import { useState } from "react";
import { X, CheckCircle2, Copy, Check } from "lucide-react";
import { SavedForm } from "../page";

export default function FormCreatedModal({
  saved, onClose, onViewForm,
}: {
  saved: SavedForm;
  onClose: () => void;
  onViewForm: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const isEmbed = saved.type === "embed";
  const value = isEmbed ? saved.embedCode! : saved.url!;

  const copy = () => {
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="tv-modal-overlay" onClick={onClose}>
      <div
        className="tv-modal w-[min(480px,92vw)] rounded-xl bg-white p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end -mt-3 -mr-3">
          <button className="tv-icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="flex flex-col items-center text-center">
          <CheckCircle2 size={40} className="text-emerald-500" strokeWidth={1.6} />
          <h2 className="mt-3 text-[18px] font-bold text-gray-900">Form Created</h2>
          <p className="mt-1 text-[13px] text-gray-500">
            {isEmbed
              ? "Your form has been successfully created. You can paste its embed code into any page of the website where you want it to show."
              : "Your form has been successfully created."}
          </p>
        </div>
        <div className="mt-5">
          <span className="tv-label">{isEmbed ? "Form Embed Code" : "Form URL"}</span>
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
            <span className={`flex-1 truncate text-[12px] text-gray-700 ${isEmbed ? "font-mono !text-[10px]" : ""}`}>{value}</span>
            <button className="tv-icon-btn !h-7 !w-7 shrink-0" onClick={copy}>
              {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            </button>
          </div>
        </div>
        <div className="mt-6 flex justify-center gap-3">
          {isEmbed ? (
            <button className="tv-btn-primary" onClick={copy}>{copied ? "Copied!" : "Copy Embed Code"}</button>
          ) : (
            <button className="tv-btn-primary" onClick={() => { onClose(); onViewForm(); }}>View Form</button>
          )}
          <button className="tv-btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
