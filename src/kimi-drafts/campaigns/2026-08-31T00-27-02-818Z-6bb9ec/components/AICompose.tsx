"use client";
import { useState } from "react";
import { Sparkles, X, RefreshCw, User } from "lucide-react";
import { aiMessages, tones } from "../mock-data";

export default function AICompose({ onUse, onClose }: { onUse: (m: string) => void; onClose: () => void }) {
  const [instructions, setInstructions] = useState("Write me a promo for a Black Friday dress sale. We are offering 40% off for 12 hours");
  const [generated, setGenerated] = useState(false);
  const [toneOpen, setToneOpen] = useState(false);
  const [tone, setTone] = useState("Fun");
  const [loading, setLoading] = useState(false);

  const generate = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); setGenerated(true); }, 900);
  };

  return (
    <div className="absolute z-30 left-[240px] right-[340px] top-16 tv-card shadow-2xl p-5 flex gap-5">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <h3 className="flex items-center gap-2 text-[15px] font-bold text-[#1a1f36]"><Sparkles size={15} className="text-[#3f4bd8]" /> AI Compose</h3>
          <button onClick={onClose} className="text-[#9aa1b5] hover:text-[#1a1f36]"><X size={16} /></button>
        </div>
        <p className="text-[12px] text-[#6b7288] mb-4">Leverage the power of AI to generate ideas for your messages. Provide some instructions on what you're looking for and receive content that's optimized for maximum engagement.</p>
        <label className="text-[12px] font-semibold text-[#1a1f36]">Instructions</label>
        <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} className="tv-input w-full mt-1 p-3 text-[13px] resize-none" />
        <div className="flex gap-2 mt-3">
          {["Length", "Tone", "Emojis", "Language"].map((f) => (
            <div key={f} className="relative">
              <button
                onClick={() => f === "Tone" && setToneOpen(!toneOpen)}
                className="tv-input px-3 py-1.5 text-[12px] font-medium text-[#4a5068] flex items-center gap-1.5"
              >
                {f === "Tone" ? `Tone: ${tone}` : f}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
              </button>
              {f === "Tone" && toneOpen && (
                <div className="absolute top-9 left-0 tv-card shadow-lg z-10 w-[160px] py-1">
                  {tones.map((t) => (
                    <button key={t} onClick={() => { setTone(t); setToneOpen(false); }} className={`block w-full text-left px-3 py-1.5 text-[12.5px] hover:bg-[#f5f6fa] ${t === tone ? "text-[#3f4bd8] font-semibold" : "text-[#1a1f36]"}`}>{t}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <button onClick={generate} disabled={loading} className="tv-btn-primary w-full mt-4 py-2.5 text-[13px]">
          {loading ? "Generating…" : "Generate Messages"}
        </button>
        <button onClick={() => setGenerated(false)} className="w-full text-center text-[12px] text-[#6b7288] mt-2 hover:text-[#1a1f36]">Start Over</button>
        <p className="text-[10.5px] text-[#9aa1b5] mt-2">You are responsible for the content you generate and all messages sent.</p>
      </div>
      <div className="w-[300px] border-l border-[#eef0f5] pl-5 max-h-[420px] overflow-y-auto">
        {!generated ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-[#9aa1b5]">
            <Sparkles size={26} className="mb-2 text-[#c7cdea]" />
            <p className="text-[12px]">Provide some instructions on what you're looking for and receive content that's optimized for engagement!</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-end"><div className="bg-[#3f4bd8] text-white text-[11.5px] rounded-xl rounded-br-sm px-3 py-2 max-w-[85%]">{instructions}</div></div>
            <div className="flex items-center gap-1.5 text-[10px] text-[#9aa1b5]"><Sparkles size={10} /> AI Compose <RefreshCw size={9} className="ml-auto cursor-pointer" /></div>
            {aiMessages.map((m, i) => (
              <div key={i} className="border border-[#e6e9f0] rounded-xl p-3">
                <p className="text-[11.5px] leading-relaxed text-[#1a1f36]">{m}</p>
                <div className="flex items-center justify-between mt-2">
                  <button onClick={() => onUse(m)} className="text-[11.5px] font-semibold text-[#3f4bd8] underline">Use Message</button>
                  <User size={11} className="text-[#9aa1b5]" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
