"use client";
import { useMemo, useState } from "react";
import { Megaphone, Paperclip, Smile, Braces, Sparkles, Smartphone, X, ListFilter, Users, HelpCircle, Send, Loader2, CheckCircle2 } from "lucide-react";
import PhonePreview from "./PhonePreview";
import RecurringModal from "./RecurringModal";
import LinkTracker from "./LinkTracker";
import { lists as defaultLists, segments as defaultSegments, aiMessages, aiFunMessages, tones, mergeTags } from "./kimi-defaults";

export default function CreateCampaign({
  onCancel,
  onReview,
  lists = defaultLists,
  segments = defaultSegments,
}: {
  onCancel: () => void;
  onReview: (msg: string) => void;
  lists?: string[];
  segments?: string[];
}) {
  const [name, setName] = useState("Black Friday Dress Sale");
  const [message, setMessage] = useState("");
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [chips, setChips] = useState<string[]>(["Nashville Store", "Joined in Last 30 Days"]);
  const [when, setWhen] = useState("Now");
  const [showRecurring, setShowRecurring] = useState(false);
  const [recurringSummary, setRecurringSummary] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [aiTone, setAiTone] = useState<string | null>(null);
  const [toneOpen, setToneOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [showTest, setShowTest] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [testSending, setTestSending] = useState(false);

  const limit = 402;
  const count = useMemo(() => message.length, [message]);

  // Detect a trackable URL in the message that hasn't been shortened yet
  const detectedUrl = useMemo(() => {
    const m = message.match(/(www\.\S+|https?:\/\/\S+)/);
    if (m && !message.includes("stxt.io")) return m[0];
    return null;
  }, [message]);

  const tools = [
    { icon: <Paperclip size={16} />, tip: "Attach a File", action: () => {} },
    { icon: <Smile size={16} />, tip: "Emojis", action: () => setMessage(message + "🎉") },
    { icon: <Braces size={16} />, tip: "Merge Tags", action: () => { setMergeOpen(!mergeOpen); setAiOpen(false); } },
    { icon: <Sparkles size={16} />, tip: "AI Compose", action: () => { setAiOpen(!aiOpen); setMergeOpen(false); } },
  ];

  const currentAiMessages = aiTone === "Fun" ? aiFunMessages : aiMessages;

  return (
    <div className="st-fade">
      <div className="text-[12px] text-gray-400 mb-2">Campaigns / <span className="text-gray-600">Create Campaign</span></div>
      <div className="grid grid-cols-[1fr_360px] gap-10">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center"><Megaphone size={18} className="text-indigo-600" /></div>
            <h1 className="text-[22px] font-semibold">Create Campaign</h1>
            <HelpCircle size={15} className="text-gray-300" />
          </div>
          <p className="text-[13.5px] text-gray-500 mb-6 ml-12">Create a campaign to reach your contacts at scale.</p>

          <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Campaign Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2.5 text-[13.5px] bg-card mb-5 focus:outline-none focus:ring-2 focus:ring-indigo-200" />

          <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Audience</label>
          <div className="relative mb-5">
            <div onClick={() => setAudienceOpen(!audienceOpen)} className="flex items-center gap-1.5 flex-wrap border border-border rounded-lg px-2 py-1.5 bg-card cursor-text min-h-[42px]">
              {chips.map((c) => (
                <span key={c} className="st-chip">
                  {c}
                  <X size={12} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setChips(chips.filter((x) => x !== c)); }} />
                </span>
              ))}
              <input placeholder="Search" className="flex-1 min-w-[80px] text-[13px] px-1 py-1 focus:outline-none bg-transparent" />
            </div>
            {audienceOpen && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-border rounded-lg shadow-lg py-2 st-fade">
                <div className="px-3 text-[10.5px] font-semibold text-gray-400 uppercase">Everyone</div>
                <div onClick={() => setChips([...new Set([...chips, "All Contacts"])])} className="flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-gray-50 cursor-pointer"><Users size={14} className="text-gray-400" /> All Contacts</div>
                <div className="px-3 pt-2 text-[10.5px] font-semibold text-gray-400 uppercase">Lists</div>
                {lists.map((l) => (
                  <div key={l} onClick={() => setChips([...new Set([...chips, l])])} className="flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-gray-50 cursor-pointer"><ListFilter size={14} className="text-gray-400" /> {l}</div>
                ))}
                <div className="px-3 pt-2 text-[10.5px] font-semibold text-gray-400 uppercase">Segments</div>
                {segments.map((s) => (
                  <div key={s} onClick={() => setChips([...new Set([...chips, s])])} className="flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-gray-50 cursor-pointer"><Users size={14} className="text-gray-400" /> {s}</div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[13px] font-medium text-gray-700">Message</label>
            <span className="text-[11.5px] text-gray-400">{count}/{limit} <span className="text-indigo-500 font-medium">1</span></span>
          </div>
          <div className="relative border border-border rounded-lg bg-card mb-6 focus-within:ring-2 focus-within:ring-indigo-200">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="w-full px-3 pt-3 pb-10 text-[13.5px] bg-transparent resize-none focus:outline-none rounded-lg"
            />
            {detectedUrl && (
              <div className="px-2 pb-12">
                <LinkTracker
                  url={detectedUrl}
                  onShorten={(shortUrl) => setMessage(message.replace(detectedUrl, shortUrl))}
                  onSkip={() => setMessage(message.replace(detectedUrl, detectedUrl.replace("www.", "www.")))}
                />
              </div>
            )}
            <div className="absolute bottom-2 left-2 flex items-center gap-1">
              {tools.map((t) => (
                <div key={t.tip} className="relative">
                  <button
                    onMouseEnter={() => setTooltip(t.tip)}
                    onMouseLeave={() => setTooltip(null)}
                    onClick={t.action}
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  >{t.icon}</button>
                  {tooltip === t.tip && (
                    <div className="absolute bottom-9 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[11px] px-2 py-1 rounded whitespace-nowrap z-30">{t.tip}</div>
                  )}
                </div>
              ))}
            </div>
            <div className="absolute bottom-2 right-2">
              <div className="relative">
                <button
                  onMouseEnter={() => setTooltip("Send a Test")}
                  onMouseLeave={() => setTooltip(null)}
                  onClick={() => setShowTest(true)}
                  className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <Smartphone size={16} />
                </button>
                {tooltip === "Send a Test" && (
                  <div className="absolute bottom-9 right-0 bg-gray-900 text-white text-[11px] px-2 py-1 rounded whitespace-nowrap z-30">Send a Test</div>
                )}
              </div>
            </div>
          </div>

          <label className="block text-[13px] font-medium text-gray-700 mb-1.5">When to Send</label>
          <div className="flex bg-gray-100 rounded-lg p-1 w-72 mb-3">
            {["Now", "Later", "Recurring"].map((w) => (
              <button
                key={w}
                onClick={() => { setWhen(w); if (w === "Recurring") setShowRecurring(true); }}
                className={`flex-1 text-[13px] py-1.5 rounded-md ${when === w ? "bg-white shadow-sm font-medium border border-indigo-200" : "text-gray-500"}`}
              >{w}</button>
            ))}
          </div>
          {when === "Later" && (
            <div className="flex gap-2 items-end mb-3 st-fade">
              <div>
                <label className="block text-[11.5px] text-gray-500 mb-1">Date</label>
                <input defaultValue="04/17/2025" className="border border-border rounded-lg px-3 py-2 text-[13px] w-36 bg-card" />
              </div>
              <div>
                <label className="block text-[11.5px] text-gray-500 mb-1">Time (CDT)</label>
                <div className="flex gap-1.5">
                  <select className="border border-border rounded-lg px-2 py-2 text-[13px] bg-card"><option>4</option></select>
                  <select className="border border-border rounded-lg px-2 py-2 text-[13px] bg-card"><option>29</option></select>
                  <select className="border border-border rounded-lg px-2 py-2 text-[13px] bg-card"><option>PM</option></select>
                </div>
              </div>
            </div>
          )}
          {recurringSummary && when === "Recurring" && (
            <div className="text-[12.5px] bg-indigo-50 text-indigo-700 rounded-lg px-3 py-2 mb-3 w-fit st-fade">{recurringSummary}</div>
          )}

          <div className="flex items-center justify-between mt-10">
            <button onClick={onCancel} className="border border-border rounded-lg px-4 py-2 text-[13px] text-gray-600 hover:bg-gray-50 bg-card">Cancel</button>
            <div className="flex gap-2">
              <button className="text-[13px] text-gray-500 px-4 py-2 hover:text-gray-700">Save Draft</button>
              <button onClick={() => onReview(message)} className="bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-medium rounded-lg px-4 py-2">Review →</button>
            </div>
          </div>
        </div>

        <div className="pt-10">
          <PhonePreview message={message} />
        </div>
      </div>

      {mergeOpen && (
        <div className="fixed z-40 left-[560px] top-[420px] bg-white border border-border rounded-xl shadow-xl w-72 p-3 st-fade">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-[13px] font-semibold"><Braces size={14} /> Merge Tags</div>
            <button onClick={() => setMergeOpen(false)} className="text-gray-400"><X size={15} /></button>
          </div>
          <input placeholder="Search" className="w-full border border-border rounded-lg px-3 py-1.5 text-[12.5px] mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          <div className="max-h-48 overflow-y-auto st-scroll">
            {mergeTags.map((t) => (
              <div key={t} onClick={() => { setMessage(message + ` {{${t.toLowerCase().replace(/ /g, "_")}}}`); setMergeOpen(false); }} className="px-2 py-1.5 text-[12.5px] text-gray-700 hover:bg-gray-50 rounded cursor-pointer">{t}</div>
            ))}
          </div>
        </div>
      )}

      {aiOpen && (
        <div className="fixed z-40 right-[380px] top-[90px] bg-white border border-border rounded-xl shadow-xl w-[420px] p-4 st-fade">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5 text-[14px] font-semibold"><Sparkles size={15} className="text-indigo-600" /> AI Compose</div>
            <button onClick={() => setAiOpen(false)} className="text-gray-400"><X size={16} /></button>
          </div>
          <p className="text-[12px] text-gray-500 mb-3">Leverage the power of AI to generate ideas for your messages. Provide some instructions on what you're looking for and receive content that's optimized for maximum engagement.</p>
          {!aiGenerated ? (
            <>
              <label className="block text-[12px] font-medium text-gray-600 mb-1">Instructions</label>
              <textarea defaultValue="Write me a promo for a Black Friday dress sale. We are offering 40% off for 12 hours" rows={3} className="w-full border border-border rounded-lg px-3 py-2 text-[12.5px] mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
              <button onClick={() => setAiGenerated(true)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-medium rounded-lg py-2 mb-2">Generate Messages</button>
              <button onClick={() => setAiGenerated(false)} className="w-full text-[12.5px] text-gray-500 py-1">Start Over</button>
              <p className="text-[10.5px] text-gray-400 mt-2">You are responsible for the content you generate and all messages sent.</p>
            </>
          ) : (
            <>
              <div className="bg-indigo-600 text-white text-[12.5px] rounded-lg px-3 py-2 mb-3">Write me a promo for a Black Friday dress sale. We are offering 40% off for 12 hours</div>
              <div className="flex gap-2 mb-3 relative">
                <select className="border border-border rounded-lg px-2 py-1.5 text-[12px] flex-1"><option>Length</option></select>
                <div className="relative flex-1">
                  <button onClick={() => setToneOpen(!toneOpen)} className={`w-full border rounded-lg px-2 py-1.5 text-[12px] text-left ${aiTone ? "border-indigo-300 text-indigo-600 font-medium" : "border-border"}`}>{aiTone || "Tone"}</button>
                  {toneOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-border rounded-lg shadow-lg py-1 st-fade">
                      {tones.map((t) => (
                        <div key={t} onClick={() => { setAiTone(t); setToneOpen(false); }} className={`px-3 py-1.5 text-[12px] hover:bg-gray-50 cursor-pointer ${aiTone === t ? "text-indigo-600 font-medium" : ""}`}>{t}</div>
                      ))}
                    </div>
                  )}
                </div>
                <select className="border border-border rounded-lg px-2 py-1.5 text-[12px] flex-1"><option>Emojis</option></select>
                <select className="border border-border rounded-lg px-2 py-1.5 text-[12px] flex-1"><option>Language</option></select>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto st-scroll">
                {currentAiMessages.map((m, i) => (
                  <div key={i} className="border border-border rounded-lg p-3">
                    <p className="text-[12.5px] text-gray-700 mb-2">{m}</p>
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => { setMessage(m); setAiOpen(false); }}
                        className="text-[12px] text-indigo-600 font-medium border border-indigo-200 rounded-md px-2.5 py-1 hover:bg-indigo-50"
                      >Use Message</button>
                      <Sparkles size={13} className="text-gray-300" />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {showTest && (
        <div className="fixed inset-0 z-50 st-modal-backdrop flex items-center justify-center" onClick={() => { setShowTest(false); setTestSent(false); }}>
          <div className="bg-white rounded-xl shadow-2xl w-[360px] p-6 st-fade" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 font-semibold text-[15px]"><Smartphone size={16} className="text-indigo-600" /> Send a Test</div>
              <button onClick={() => { setShowTest(false); setTestSent(false); }} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            {!testSent ? (
              <>
                <p className="text-[12.5px] text-gray-500 mb-3">Send a test message to your phone to see exactly how it will look to your contacts.</p>
                <label className="block text-[12.5px] font-medium text-gray-600 mb-1.5">Phone Number</label>
                <input defaultValue="(615) 555-0132" className="w-full border border-border rounded-lg px-3 py-2 text-[13px] mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setTestSending(true); setTimeout(() => { setTestSending(false); setTestSent(true); }, 800); }}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-medium rounded-lg py-2 flex items-center justify-center gap-1.5"
                  >
                    {testSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={13} />}
                    {testSending ? "Sending…" : "Send Test"}
                  </button>
                  <button onClick={() => setShowTest(false)} className="flex-1 border border-border text-[13px] rounded-lg py-2 text-gray-600 hover:bg-gray-50">Cancel</button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center py-4 st-fade">
                <CheckCircle2 size={32} className="text-emerald-500 mb-2" />
                <div className="text-[14px] font-medium text-gray-800">Test message sent!</div>
                <div className="text-[12px] text-gray-400 mt-1">Check your phone for the message.</div>
              </div>
            )}
          </div>
        </div>
      )}

      {showRecurring && (
        <RecurringModal
          onClose={() => setShowRecurring(false)}
          onSet={(s) => { setRecurringSummary(s); setShowRecurring(false); }}
        />
      )}
    </div>
  );
}
