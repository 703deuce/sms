"use client";

import { campaignUi } from "@/components/campaigns/broadcast/campaign-layout";
import { cn } from "@/lib/utils";
import { Loader2, Sparkles, X } from "lucide-react";
import { useState } from "react";

type AiComposeModalProps = {
  open: boolean;
  onClose: () => void;
  onUseMessage: (message: string) => void;
};

export function AiComposeModal({ open, onClose, onUseMessage }: AiComposeModalProps) {
  const [prompt, setPrompt] = useState("");
  const [length, setLength] = useState("Short");
  const [tone, setTone] = useState("Friendly");
  const [emojis, setEmojis] = useState("Some");
  const [language, setLanguage] = useState("English");
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function generate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ai/campaign-compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: prompt,
          audience: "SMS subscribers",
          tone: tone.toLowerCase(),
          offer: "",
          length: length.toLowerCase(),
          emojis: emojis.toLowerCase(),
          language: language.toLowerCase(),
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
      if (messages.length === 0) throw new Error(json.error || "No messages returned");
      setOptions(messages.slice(0, 3));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate");
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-[900px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-6 py-4">
          <h2 className="text-[18px] font-bold text-[#111827]">AI Compose</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-[#f3f4f6]">
            <X className="h-5 w-5 text-[#6b7280]" />
          </button>
        </div>
        <div className="grid flex-1 overflow-auto lg:grid-cols-2">
          <div className="space-y-4 border-b border-[#e5e7eb] p-6 lg:border-b-0 lg:border-r">
            <div>
              <label className={campaignUi.label}>What should this message say?</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Write a promotion for our Labor Day plumbing special."
                className={cn(campaignUi.textarea, "mt-1.5 min-h-[100px]")}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={campaignUi.label}>Length</label>
                <select
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                  className={cn(campaignUi.input, "mt-1.5")}
                >
                  <option>Short</option>
                  <option>Medium</option>
                  <option>Long</option>
                </select>
              </div>
              <div>
                <label className={campaignUi.label}>Tone</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className={cn(campaignUi.input, "mt-1.5")}
                >
                  <option>Friendly</option>
                  <option>Professional</option>
                  <option>Urgent</option>
                  <option>Casual</option>
                </select>
              </div>
              <div>
                <label className={campaignUi.label}>Emojis</label>
                <select
                  value={emojis}
                  onChange={(e) => setEmojis(e.target.value)}
                  className={cn(campaignUi.input, "mt-1.5")}
                >
                  <option>None</option>
                  <option>Some</option>
                  <option>Many</option>
                </select>
              </div>
              <div>
                <label className={campaignUi.label}>Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className={cn(campaignUi.input, "mt-1.5")}
                >
                  <option>English</option>
                  <option>Spanish</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void generate()}
              disabled={loading || !prompt.trim()}
              className={campaignUi.primaryBtn}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate Messages
            </button>
            {error ? <p className="text-[13px] text-[#dc2626]">{error}</p> : null}
          </div>
          <div className="space-y-4 p-6">
            <p className={campaignUi.label}>Suggestions</p>
            {options.length === 0 ? (
              <p className="text-[13px] text-[#6b7280]">
                Enter instructions and generate message options.
              </p>
            ) : (
              options.map((msg, i) => (
                <div key={i} className="rounded-xl border border-[#e5e7eb] p-4">
                  <p className="whitespace-pre-wrap text-[13px] text-[#374151]">{msg}</p>
                  <button
                    type="button"
                    className={cn(campaignUi.ghostBtn, "mt-3 px-0")}
                    onClick={() => {
                      onUseMessage(msg);
                      onClose();
                    }}
                  >
                    Use Message
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
