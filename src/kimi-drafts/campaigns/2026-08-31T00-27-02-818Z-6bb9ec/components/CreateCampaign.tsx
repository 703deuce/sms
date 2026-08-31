"use client";
import { useState, useRef } from "react";
import { Paperclip, Smile, Braces, Sparkles, Smartphone, X, Megaphone, HelpCircle, Users, List, ChevronLeft } from "lucide-react";
import { audiences, mergeTags } from "../mock-data";
import AICompose from "./AICompose";
import RecurringModal from "./RecurringModal";
import PhonePreview from "./PhonePreview";

interface Props {
  onBack: () => void;
  onReview: (data: { name: string; message: string; audience: string[] }) => void;
}

export default function CreateCampaign({ onBack, onReview }: Props) {
  const [name, setName] = useState("Black Friday Dress Sale");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<{ id: string; label: string }[]>([
    { id: "nash", label: "Nashville Store" },
    { id: "joined30", label: "Joined in Last 30 Days" },
  ]);
  const [audOpen, setAudOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [when, setWhen] = useState<"Now" | "Later" | "Recurring">("Now");
  const [recurringSummary, setRecurringSummary] = useState("");
  const [linkPrompt, setLinkPrompt] = useState(false);
  const [linkNaming, setLinkNaming] = useState(false);
  const [linkName, setLinkName] = useState("Black Friday Landing Page");
  const [tip, setTip] = useState<string | null>(null);
  const msgRef = useRef<HTMLTextAreaElement>(null);

  const limit = 402;
  const insertAtCursor = (text: string) => {
    const el = msgRef.current;
    if (!el) { setMessage(message + text); return; }
    const s = el.selectionStart ?? message.length;
    const e = el.selectionEnd ?? message.length;
    setMessage(message.slice(0, s) + text + message.slice(e));
  };

  const handleMessageChange = (v: string) => {
    setMessage(v);
    if (/www\.\S+\.com/.test(v) && !linkPrompt && !v.includes("stxt.io")) setLinkPrompt(true);
  };

  const shorten = () => {
    setMessage(message.replace(/www\.\S+\.com/, "stxt.io/lea/B72c4aa521"));
    setLinkNaming(false);
    setLinkPrompt(false);
  };

  const toggleAudience = (a: { id: string; label: string }) => {
    setSelected(selected.some((s) => s.id === a.id) ? selected.filter((s) => s.id !== a.id) : [...selected, a]);
  };

  const toolBtn = (icon: React.ReactNode, label: string, onClick: () => void) => (
    <button onClick={onClick} onMouseEnter={() => setTip(label)} onMouseLeave={() => setTip(null)} className="relative p-1.5 text-[#6b7288] hover:text-[#1a1f36]">
      {icon}
      {tip === label && <span className="tv-tooltip">{label}</span>}
    </button>
  );

  return (
    <div className="relative flex-1 flex flex-col">
      <div className="flex-1 grid grid-cols-[1fr_340px] gap-8 p-8">
        <div className="max-w-[560px]">
          <p className="text-[12px] text-[#6b7288] mb-1">Campaigns / Create Campaign</p>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-[#eef0fd] flex items-center justify-center"><Megaphone size={16} className="text-[#3f4bd8]" /></div>
            <h1 className="text-[22px] font-bold text-[#1a1f36]">Create Campaign</h1>
            <HelpCircle size={15} className="text-[#9aa1b5]" />
          </div>
          <p className="text-[13px] text-[#6b7288] mb-6">Create a campaign to reach your contacts at scale.</p>

          <label className="text-[12.5px] font-semibold text-[#1a1f36]">Campaign Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="tv-input w-full mt-1.5 mb-5 px-3 py-2.5 text-[13.5px]" />

          <label className="text-[12.5px] font-semibold text-[#1a1f36]">Audience</label>
          <div className="relative mt-1.5 mb-5">
            <div onClick={() => setAudOpen(!audOpen)} className="tv-input w-full px-2.5 py-2 flex items-center gap-1.5 flex-wrap cursor-pointer min-h-[42px]">
              {selected.map((s) => (
                <span key={s.id} className="tv-chip">
                  {s.id === "joined30" ? <Users size={11} /> : <List size={11} />}
                  {s.label}
                  <X size={11} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleAudience(s); }} />
                </span>
              ))}
              <input placeholder="Search" className="flex-1 min-w-[70px] outline-none text-[13px] bg-transparent" />
            </div>
            {audOpen && (
              <div className="absolute z-20 top-full mt-1 w-full tv-card shadow-lg py-2 text-[13px] max-h-[240px] overflow-y-auto">
                <p className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wide text-[#9aa1b5]">Everyone</p>
                {audiences.everyone.map((a) => (
                  <button key={a.id} onClick={() => toggleAudience(a)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#f5f6fa] text-[#1a1f36]"><Users size={13} className="text-[#6b7288]" /> {a.label}</button>
                ))}
                <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-[#9aa1b5]">Lists</p>
                {audiences.lists.map((a) => (
                  <button key={a.id} onClick={() => toggleAudience(a)} className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-[#f5f6fa] ${selected.some((s) => s.id === a.id) ? "bg-[#eef0fd] text-[#3f4bd8]" : "text-[#1a1f36]"}`}><List size={13} className="text-[#6b7288]" /> {a.label}</button>
                ))}
                <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-[#9aa1b5]">Segments</p>
                {audiences.segments.map((a) => (
                  <button key={a.id} onClick={() => toggleAudience(a)} className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-[#f5f6fa] ${selected.some((s) => s.id === a.id) ? "bg-[#eef0fd] text-[#3f4bd8]" : "text-[#1a1f36]"}`}><Users size={13} className="text-[#6b7288]" /> {a.label}</button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <label className="text-[12.5px] font-semibold text-[#1a1f36]">Message</label>
            <span className="text-[11.5px] text-[#9aa1b5]">{message.length}/{limit} {message.length > 160 && <span className="ml-1 bg-[#eef0fd] text-[#3f4bd8] rounded-full px-1.5 py-0.5 text-[10px] font-bold">2</span>}</span>
          </div>
          <div className="tv-input mt-1.5 mb-5 focus-within:border-[#3f4bd8]">
            <textarea
              ref={msgRef}
              value={message}
              onChange={(e) => handleMessageChange(e.target.value)}
              rows={5}
              className="w-full p-3 text-[13px] resize-none outline-none bg-transparent"
            />
            <div className="flex items-center gap-1 px-2 pb-2 relative">
              {toolBtn(<Paperclip size={15} />, "Attach a File", () => {})}
              {toolBtn(<Smile size={15} />, "Emojis", () => insertAtCursor("🎉"))}
              <div className="relative">
                {toolBtn(<Braces size={15} />, "Merge Tags", () => { setMergeOpen(!mergeOpen); })}
                {mergeOpen && (
                  <div className="absolute z-20 bottom-8 left-0 tv-card shadow-lg w-[220px] py-2">
                    <input placeholder="Search" className="tv-input mx-2 mb-2 px-2.5 py-1.5 text-[12px] w-[calc(100%-16px)]" />
                    {mergeTags.map((t) => (
                      <button key={t.tag} onClick={() => { insertAtCursor(t.tag); setMergeOpen(false); }} className="w-full flex items-center justify-between px-3 py-1.5 text-[12.5px] hover:bg-[#f5f6fa] text-[#1a1f36]">
                        {t.label} <span className="text-[10.5px] text-[#9aa1b5]">{t.tag}</span>
                      </button>
                    ))}
                    <p className="px-3 pt-2 text-[10.5px] text-[#6b7288] border-t border-[#eef0f5] mt-1">Merge tags allow you to personalize messages with info specific to each contact.</p>
                  </div>
                )}
              </div>
              {toolBtn(<Sparkles size={15} />, "AI Compose", () => setAiOpen(true))}
              <div className="flex-1" />
              {toolBtn(<Smartphone size={15} />, "Send a Test", () => {})}
            </div>
            {linkPrompt && !linkNaming && (
              <div className="flex items-center justify-between px-3 py-2 border-t border-[#eef0f5] text-[12px] text-[#4a5068]">
                <span>Track the www.transovo.com link?</span>
                <span className="flex gap-3">
                  <button onClick={() => { setLinkNaming(true); }} className="font-semibold text-[#3f4bd8] underline">Yes</button>
                  <button onClick={() => setLinkPrompt(false)} className="font-semibold text-[#3f4bd8] underline">No</button>
                </span>
              </div>
            )}
            {linkNaming && (
              <div className="flex items-center gap-3 px-3 py-2 border-t border-[#eef0f5]">
                <input value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="Name your link" className="flex-1 text-[12.5px] outline-none border-b border-[#3f4bd8] py-1" />
                <button onClick={shorten} className="text-[12px] font-semibold text-[#3f4bd8] underline">Shorten</button>
                <button onClick={() => { setLinkNaming(false); setLinkPrompt(false); }} className="text-[12px] font-semibold text-[#6b7288] underline">Cancel</button>
              </div>
            )}
          </div>

          <label className="text-[12.5px] font-semibold text-[#1a1f36]">When to Send</label>
          <div className="tv-seg mt-1.5">
            {(["Now", "Later", "Recurring"] as const).map((w) => (
              <button key={w} className={when === w ? "active" : ""} onClick={() => { setWhen(w); if (w === "Recurring") setRecurringOpen(true); }}>{w}</button>
            ))}
          </div>
          {when === "Later" && (
            <div className="flex gap-3 mt-3">
              <div>
                <label className="text-[11.5px] font-semibold text-[#1a1f36]">Date</label>
                <input type="date" defaultValue="2025-04-17" className="tv-input mt-1 px-3 py-2 text-[13px]" />
              </div>
              <div>
                <label className="text-[11.5px] font-semibold text-[#1a1f36]">Time (CDT)</label>
                <div className="flex gap-2 mt-1">
                  <select className="tv-input px-2 py-2 text-[13px] w-[60px]"><option>4</option>{[1,2,3,5,6,7,8,9,10,11,12].map((n)=><option key={n}>{n}</option>)}</select>
                  <select className="tv-input px-2 py-2 text-[13px] w-[64px]"><option>29</option><option>00</option><option>15</option><option>30</option><option>45</option></select>
                  <select className="tv-input px-2 py-2 text-[13px] w-[70px]"><option>PM</option><option>AM</option></select>
                </div>
              </div>
            </div>
          )}
          {when === "Recurring" && recurringSummary && (
            <p className="mt-3 text-[12.5px] text-[#3f4bd8] bg-[#eef0fd] rounded-lg px-3 py-2.5 flex items-center justify-between">
              {recurringSummary}
              <button onClick={() => setRecurringOpen(true)} className="text-[#6b7288] hover:text-[#1a1f36]">✎</button>
            </p>
          )}
        </div>
        <PhonePreview message={message} label="Message Preview" />
      </div>

      {aiOpen && <AICompose onClose={() => setAiOpen(false)} onUse={(m) => { setMessage(m); setAiOpen(false); }} />}
      {recurringOpen && <RecurringModal onClose={() => setRecurringOpen(false)} onSet={(s) => { setRecurringSummary(s); setRecurringOpen(false); }} />}

      <div className="sticky bottom-0 bg-white border-t border-[#e6e9f0] px-8 py-4 flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] font-semibold text-[#4a5068] hover:text-[#1a1f36]"><ChevronLeft size={15} /> Cancel</button>
        <div className="flex gap-3">
          <button onClick={onBack} className="text-[13px] font-semibold text-[#4a5068] hover:text-[#1a1f36] px-3 py-2">Save Draft</button>
          <button
            onClick={() => onReview({ name, message, audience: selected.map((s) => s.label) })}
            disabled={!name || !message || selected.length === 0}
            className="tv-btn-primary px-5 py-2 text-[13px] flex items-center gap-1.5"
          >
            Review <span>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
