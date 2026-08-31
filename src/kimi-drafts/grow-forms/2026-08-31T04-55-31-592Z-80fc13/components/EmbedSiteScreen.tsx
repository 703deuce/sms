"use client";
import React, { useState } from "react";
import { ArrowLeft, Plus, Code2, X } from "lucide-react";

const blocks = [
  { id: "text", label: "Text", icon: "T" },
  { id: "image", label: "Image", icon: "🖼" },
  { id: "button", label: "Button", icon: "▭" },
  { id: "video", label: "Video", icon: "▶" },
  { id: "form", label: "Form", icon: "☰" },
  { id: "audio", label: "Audio", icon: "♪" },
  { id: "newsletter", label: "Newsletter", icon: "✉" },
  { id: "accordion", label: "Accordion", icon: "≣" },
  { id: "embed", label: "Embed", icon: "</>" },
  { id: "code", label: "Code", icon: "{ }" },
];

export default function EmbedSiteScreen({ onBack }: { onBack: () => void }) {
  const [palette, setPalette] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [embedded, setEmbedded] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <div className="tv-forms min-h-[calc(100vh-64px)] bg-black text-white flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1 border border-slate-700 rounded px-2 py-1 hover:bg-slate-800"><ArrowLeft size={12} /> Back</button>
          <button onClick={() => setSaved(true)} className="bg-white text-black font-semibold px-3 py-1 rounded">{saved ? "SAVED ✓" : "SAVE"}</button>
          <span className="text-slate-400">EXIT</span>
        </div>
        <span className="text-slate-400">Contact &nbsp;·&nbsp; Page: Published</span>
        <div className="flex gap-2 text-slate-400"><span>🖥</span><span>📱</span></div>
      </div>

      <div className="flex items-center justify-between px-6 py-4">
        <span className="font-semibold">Transovo Tutorials</span>
        <div className="flex gap-6 text-sm text-slate-300"><span>Services</span><span>Work</span><span>About</span></div>
        <div className="flex gap-3 text-sm"><span>Login</span><button className="border border-slate-600 px-3 py-1">Contact Me</button></div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-4 px-6 pb-8">
        <div className="relative border border-indigo-500/60 rounded min-h-[300px] p-4">
          {!embedded ? (
            <>
              <button onClick={() => setPalette(!palette)} className="flex items-center gap-1 bg-white text-black text-xs font-medium px-3 py-1.5 rounded">
                <Plus size={12} /> ADD BLOCK
              </button>
              {palette && (
                <div className="absolute top-12 left-4 bg-white text-black rounded-lg shadow-xl w-64 p-3 tv-pop z-10">
                  <input placeholder="Search" className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs mb-2" />
                  <div className="text-[10px] text-slate-400 mb-1">Basic</div>
                  <div className="grid grid-cols-2 gap-1">
                    {blocks.map((b) => (
                      <button key={b.id} onClick={() => { setPalette(false); setCodeOpen(true); }} className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-slate-100">
                        <span className="w-5 text-center">{b.icon}</span>{b.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {codeOpen && (
                <div className="absolute top-12 left-4 right-4 bg-white text-black rounded-lg shadow-xl p-4 tv-pop z-10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold">Content</span>
                    <button onClick={() => setCodeOpen(false)}><X size={14} /></button>
                  </div>
                  <div className="flex gap-2 text-[11px] mb-2"><span>Mode</span><span className="border border-slate-300 rounded px-1.5">HTML</span></div>
                  <textarea
                    className="w-full h-24 border border-slate-200 rounded p-2 text-[11px] font-mono"
                    defaultValue={`<script async src="https://static.transovo.io/forms/scripts/embed/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9"></script>`}
                  />
                  <button onClick={() => { setCodeOpen(false); setEmbedded(true); }} className="mt-2 flex items-center gap-1 bg-indigo-600 text-white text-xs px-3 py-1.5 rounded"><Code2 size={12} /> Apply Embed</button>
                </div>
              )}
            </>
          ) : (
            <div className="tv-embed-preview" style={{ minHeight: 300, background: "transparent", padding: 8 }}>
              <h2 className="text-2xl font-semibold" style={{ fontFamily: "Georgia, serif" }}>Want 20% Off?</h2>
              <p className="text-xs text-slate-400">Join our VIP text list and receive a code for 20% off your next purchase in store or online.</p>
              <div className="tv-input-mock">First Name</div>
              <div className="tv-input-mock">Last Name</div>
              <div className="tv-input-mock">Mobile Number</div>
              <div className="tv-input-mock">Email</div>
              <div className="tv-btn-mock tv-dark-btn text-black">Join Now</div>
              <p className="text-[9px] text-slate-500">By submitting, you agree to receive automated promotional messages. Text STOP to opt out or HELP for help.</p>
            </div>
          )}
        </div>
        <div className="relative border border-indigo-500/60 rounded overflow-hidden min-h-[300px]" style={{ background: "linear-gradient(160deg,#7dd3fc 0%,#bae6fd 40%,#166534 40%,#14532d 100%)" }}>
          <div className="absolute top-2 right-2 bg-white text-black rounded-lg shadow-lg text-xs py-1 w-36 tv-pop">
            {["✎ Edit Section", "▦ View Layouts", "🖼", "♡ ↑ ↓", "🗑 Remove"].map((x, i) => (
              <div key={i} className={`px-3 py-1.5 hover:bg-slate-100 cursor-pointer ${i === 4 ? "text-red-600" : ""}`}>{x}</div>
            ))}
          </div>
          <div className="absolute bottom-6 left-6 text-4xl">🌴🌴🌴</div>
        </div>
      </div>
    </div>
  );
}
