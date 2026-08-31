"use client";
import { useState } from "react";
import { Paperclip, Smile, Braces, Sparkles, Send, ChevronRight, Megaphone, HelpCircle } from "lucide-react";
import AudiencePicker, { AudienceChip } from "./AudiencePicker";
import AIComposeModal from "./AIComposeModal";
import RecurringModal from "./RecurringModal";
import PhonePreview from "./PhonePreview";
import { mergeTags } from "../mock-data";

type SendMode = "Now" | "Later" | "Recurring";

export default function CreateCampaign({ onCancel, onReview }: { onCancel: () => void; onReview: (data: { message: string; timing: string }) => void }) {
  const [name, setName] = useState("");
  const [audience, setAudience] = useState<AudienceChip[]>([]);
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<SendMode>("Now");
  const [showAI, setShowAI] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [recurringSummary, setRecurringSummary] = useState<string | null>(null);
  const [trackPrompt, setTrackPrompt] = useState<string | null>(null);
  const [linkName, setLinkName] = useState<string | null>(null);

  const limit = 402;
  const chars = message.length;

  const handleMessageChange = (v: string) => {
    setMessage(v);
    const m = v.match(/(www\.[a-z0-9.-]+\.[a-z]{2,})/i);
    if (m && !v.includes("stxt.io")) setTrackPrompt(m[1]);
    else setTrackPrompt(null);
  };

  const insertTag = (tag: string) => { setMessage(message + " " + tag); setShowMerge(false); };

  const timing = mode === "Now" ? "Send Immediately" : mode === "Later" ? "Scheduled for 04/17/2025 4:29 PM (CDT)" : recurringSummary ?? "Recurring";

  return (
    <div className="flex-1 min-h-screen bg-[#f6f7fb] px-10 py-8">
      {showAI && <AIComposeModal onClose={() => setShowAI(false)} onUse={(m) => { setMessage(m); setShowAI(false); }} />}
      {showRecurring && (
        <RecurringModal
          onClose={() => setShowRecurring(false)}
          onSet={(s) => { setRecurringSummary(s); setShowRecurring(false); setMode("Recurring"); }}
        />
      )}

      <div className="flex items-center justify-between">
        <p className="text-[12px] text-slate-400">
          Campaigns <span className="mx-1 text-slate-300">/</span> <span className="text-slate-600 font-medium">Create Campaign</span>
        </p>
        <button className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-slate-100 transition-colors">
          <HelpCircle className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <div className="grid grid-cols-[1fr_360px] gap-14 mt-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-[22px] font-bold tracking-tight text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-indigo-50">
              <Megaphone className="w-5 h-5 text-indigo-600" />
            </span>
            Create Campaign
          </h1>
          <p className="text-sm text-slate-500 mt-1.5">Create a campaign to reach your contacts at scale.</p>

          <label className="block text-[13px] font-semibold text-slate-700 mt-7 mb-1.5">Campaign Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Black Friday Dress Sale" className="input-field max-w-md" />

          <label className="block text-[13px] font-semibold text-slate-700 mt-5 mb-1.5">Audience</label>
          <div className="max-w-md"><AudiencePicker selected={audience} onChange={setAudience} /></div>

          <div className="flex items-center justify-between max-w-md mt-5 mb-1.5">
            <label className="text-[13px] font-semibold text-slate-700">Message</label>
            <span className="flex items-center gap-1.5 text-[11px] text-slate-400 tabular-nums">
              {chars}/{limit} <span className="segment-badge">1</span>
            </span>
          </div>
          <div className="max-w-md composer-box">
            <textarea
              value={message}
              onChange={(e) => handleMessageChange(e.target.value)}
              className="w-full h-36 resize-none outline-none p-3 text-[13.5px] leading-relaxed text-slate-800 rounded-t-xl bg-transparent"
            />
            {trackPrompt && (
              <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 bg-slate-50/60">
                <span className="text-[12px] text-slate-500">Track the <span className="font-medium text-slate-700">{trackPrompt}</span> link?</span>
                <span className="flex gap-3">
                  <button onClick={() => { setTrackPrompt(null); setLinkName(""); }} className="text-[12px] font-semibold text-indigo-600 hover:text-indigo-700">Yes</button>
                  <button onClick={() => setTrackPrompt(null)} className="text-[12px] font-semibold text-slate-400 hover:text-slate-600">No</button>
                </span>
              </div>
            )}
            {linkName !== null && (
              <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-100 bg-slate-50/60">
                <input
                  autoFocus
                  value={linkName}
                  onChange={(e) => setLinkName(e.target.value)}
                  placeholder="Name your link"
                  className="flex-1 text-[12px] outline-none border-b border-indigo-300 focus:border-indigo-500 py-1 bg-transparent transition-colors"
                />
                <button
                  onClick={() => { setMessage(message.replace(/www\.[a-z0-9.-]+\.[a-z]{2,}/i, "stxt.io/lea/872c4aa521")); setLinkName(null); }}
                  className="text-[12px] font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  Shorten
                </button>
                <button onClick={() => setLinkName(null)} className="text-[12px] font-semibold text-slate-400 hover:text-slate-600">Cancel</button>
              </div>
            )}
            <div className="composer-toolbar relative flex items-center gap-1.5 px-2.5 py-2 border-t border-slate-100">
              <button title="Attach a File"><Paperclip className="w-4 h-4" /></button>
              <button title="Emojis"><Smile className="w-4 h-4" /></button>
              <div className="relative">
                <button title="Merge Tags" onClick={() => setShowMerge(!showMerge)}><Braces className="w-4 h-4" /></button>
                {showMerge && (
                  <div className="absolute bottom-9 left-0 bg-white border border-slate-200 rounded-xl shadow-xl z-20 w-64 p-2 fade-in">
                    <input placeholder="Search tags" className="input-field !py-1.5 !text-[12px] mb-1" />
                    {mergeTags.map((t) => (
                      <button key={t.label} onClick={() => insertTag(t.value)} className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg hover:bg-indigo-50 text-[13px] text-slate-700 transition-colors">
                        {t.label} <span className="text-[11px] text-slate-400 font-mono">{t.value}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button title="AI Compose" className="ai" onClick={() => setShowAI(true)}><Sparkles className="w-4 h-4" /></button>
              <button title="Send a Test" className="ml-auto"><Send className="w-4 h-4" /></button>
            </div>
          </div>

          <label className="block text-[13px] font-semibold text-slate-700 mt-6 mb-2">When to Send</label>
          <div className="seg-toggle max-w-md">
            {(["Now", "Later", "Recurring"] as SendMode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); if (m === "Recurring") setShowRecurring(true); }}
                className={`flex-1 ${mode === m ? "on" : ""}`}
              >
                {m}
              </button>
            ))}
          </div>

          {mode === "Later" && (
            <div className="flex items-end gap-2 mt-4 max-w-md fade-in">
              <div className="flex-1">
                <label className="block text-[12px] font-semibold text-slate-600 mb-1">Date</label>
                <input defaultValue="04/17/2025" className="input-field !text-[13px]" />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1">Time (CDT)</label>
                <div className="flex gap-1.5">
                  <select className="input-field !text-[13px] !w-16"><option>4</option></select>
                  <select className="input-field !text-[13px] !w-16"><option>29</option></select>
                  <select className="input-field !text-[13px] !w-20"><option>PM</option><option>AM</option></select>
                </div>
              </div>
            </div>
          )}

          {mode === "Recurring" && recurringSummary && (
            <p className="mt-4 max-w-md text-[12px] leading-relaxed text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2.5 fade-in">{recurringSummary}</p>
          )}

          <div className="flex items-center justify-between max-w-md mt-12">
            <button onClick={onCancel} className="btn-ghost">Cancel</button>
            <div className="flex items-center gap-4">
              <button className="text-[13px] font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">Save Draft</button>
              <button
                onClick={() => onReview({ message, timing })}
                disabled={!name || !message || audience.length === 0}
                className="btn-primary flex items-center gap-1.5"
              >
                Review <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <PhonePreview message={message} />
      </div>
    </div>
  );
}
