"use client";
import { useState } from "react";
import { X, Sparkles, RotateCcw, ChevronDown, Loader2 } from "lucide-react";

export default function AIComposeModal({ onClose, onUse }: { onClose: () => void; onUse: (msg: string) => void }) {
  const [instructions, setInstructions] = useState("");
  const [results, setResults] = useState<string[] | null>(null);
  const [tone, setTone] = useState<string | null>(null);
  const [toneOpen, setToneOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const tones = ["Friendly", "Professional", "Urgent", "Casual", "Fun"];

  const generate = async () => {
    if (!instructions.trim()) return;
    setGenerating(true);
    setResults(null);
    setError("");
    try {
      const res = await fetch("/api/ai/campaign-compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: instructions,
          audience: "SMS subscribers",
          tone: (tone || "Friendly").toLowerCase(),
          offer: "",
          length: "short",
          emojis: "some",
          language: "english",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not generate");
      const data = json.data && typeof json.data === "object" ? json.data : {};
      const body =
        typeof data.body === "string"
          ? data.body
          : typeof data.message === "string"
            ? data.message
            : "";
      const alt = Array.isArray(data.alternatives)
        ? data.alternatives
        : Array.isArray(data.variations)
          ? data.variations
          : [];
      const messages = [body, ...alt.filter((x: unknown) => typeof x === "string")].filter(Boolean);
      if (messages.length === 0) throw new Error("No messages returned");
      setResults(messages.slice(0, 3));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate");
      setResults(null);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card w-[520px] max-h-[85vh] overflow-y-auto p-6 fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Sparkles className="w-5 h-5 text-indigo-500" /> AI Compose</h2>
            <p className="text-[13px] text-slate-500 mt-1">Leverage the power of AI to generate ideas for your messages. Provide some instructions on what you&apos;re looking for and receive content that&apos;s optimized for maximum engagement.</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <label className="block text-[13px] font-semibold text-slate-700 mt-5 mb-1.5">Instructions</label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Write me a promo for a Black Friday dress sale. We are offering 40% off for 12 hours"
          className="input-field h-20 resize-none"
        />

        <div className="flex items-center gap-2 mt-3">
          <div className="relative">
            <button type="button" onClick={() => setToneOpen(!toneOpen)} className="btn-ghost !py-1.5 !px-3 text-xs flex items-center gap-1">
              {tone ?? "Tone"} <ChevronDown className="w-3 h-3" />
            </button>
            {toneOpen && (
              <div className="absolute top-full mt-1 left-0 bg-white border border-slate-200 rounded-lg shadow-lg z-10 w-44 py-1 fade-in">
                {tones.map((t) => (
                  <button key={t} type="button" onClick={() => { setTone(t); setToneOpen(false); }} className="block w-full text-left px-3 py-1.5 text-[13px] text-slate-700 hover:bg-indigo-50">{t}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        <button type="button" onClick={() => void generate()} disabled={!instructions || generating} className="btn-primary w-full mt-4 !py-2.5 flex items-center justify-center gap-2">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {generating ? "Generating..." : "Generate Messages"}
        </button>
        <button type="button" onClick={() => { setInstructions(""); setResults(null); setTone(null); }} className="flex items-center gap-1.5 mx-auto mt-3 text-[13px] font-medium text-slate-500 hover:text-slate-700">
          <RotateCcw className="w-3.5 h-3.5" /> Start Over
        </button>
        {error ? <p className="text-[12px] text-red-600 text-center mt-2">{error}</p> : null}
        <p className="text-[11px] text-slate-400 text-center mt-2">You are responsible for the content you generate and all messages sent.</p>

        {results && (
          <div className="mt-5 space-y-3 fade-in">
            {instructions && (
              <div className="ml-auto max-w-[85%] bg-indigo-600 text-white text-[13px] rounded-2xl rounded-br-sm px-4 py-2.5">{instructions}</div>
            )}
            {results.map((r, i) => (
              <div key={i} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <p className="text-[13px] text-slate-700 leading-relaxed">{r}</p>
                <div className="flex items-center justify-between mt-2.5">
                  <button type="button" onClick={() => onUse(r)} className="text-[13px] font-semibold text-indigo-600 hover:underline">Use Message</button>
                  <RotateCcw className="w-3.5 h-3.5 text-slate-300" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
