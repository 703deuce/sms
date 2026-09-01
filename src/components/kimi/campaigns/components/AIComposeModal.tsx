"use client";
import { useState } from "react";
import { X, Sparkles, RotateCcw, ChevronDown, Loader2, Check } from "lucide-react";

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
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-[17px] font-bold tracking-tight text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 ring-1 ring-indigo-100">
                <Sparkles className="h-4 w-4 text-indigo-500" />
              </span>
              AI Compose
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
              Leverage the power of AI to generate ideas for your messages. Provide some instructions on what you&apos;re looking for and receive content that&apos;s optimized for maximum engagement.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mb-1.5 mt-5 block text-[13px] font-semibold text-slate-700">Instructions</label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Write me a promo for a Black Friday dress sale. We are offering 40% off for 12 hours"
          className="input-field h-20 resize-none"
        />

        <div className="mt-3 flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setToneOpen(!toneOpen)}
              className="btn-ghost !py-1.5 !px-3 text-xs flex items-center gap-1.5"
            >
              {tone ?? "Tone"} <ChevronDown className={`h-3 w-3 transition-transform ${toneOpen ? "rotate-180" : ""}`} />
            </button>
            {toneOpen && (
              <div className="fade-in absolute left-0 top-full z-10 mt-1.5 w-44 rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl">
                {tones.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setTone(t); setToneOpen(false); }}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[13px] text-slate-700 transition-colors hover:bg-indigo-50"
                  >
                    {t}
                    {tone === t ? <Check className="h-3.5 w-3.5 text-indigo-600" /> : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void generate()}
          disabled={!instructions || generating}
          className="btn-primary mt-4 flex w-full items-center justify-center gap-2 !py-2.5 shadow-sm"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generating ? "Generating..." : "Generate Messages"}
        </button>
        <button
          type="button"
          onClick={() => { setInstructions(""); setResults(null); setTone(null); }}
          className="mx-auto mt-3 flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-700"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Start Over
        </button>
        {error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-[12px] text-red-700">{error}</p>
        ) : null}
        <p className="mt-2.5 text-center text-[11px] text-slate-400">
          You are responsible for the content you generate and all messages sent.
        </p>

        {results && (
          <div className="fade-in mt-5 space-y-3 border-t border-slate-100 pt-5">
            {instructions && (
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2.5 text-[13px] leading-relaxed text-white shadow-sm">
                {instructions}
              </div>
            )}
            {results.map((r, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 transition-colors hover:border-indigo-200 hover:bg-white"
              >
                <p className="text-[13px] leading-relaxed text-slate-700">{r}</p>
                <div className="mt-3 flex items-center justify-between border-t border-slate-200/70 pt-2.5">
                  <button
                    type="button"
                    onClick={() => onUse(r)}
                    className="rounded-md px-1.5 py-0.5 text-[13px] font-semibold text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    Use Message
                  </button>
                  <RotateCcw className="h-3.5 w-3.5 text-slate-300" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
