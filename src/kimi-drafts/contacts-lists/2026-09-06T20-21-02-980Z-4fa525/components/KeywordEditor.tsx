"use client";
import { useEffect, useState } from "react";
import { ChevronDown, X, MessageSquareText, List, Wifi, Signal, BatteryFull, Check } from "lucide-react";
import { ContactList, Keyword } from "../mock-data";

interface Props {
  lists: ContactList[];
  keyword: Keyword;
  onSave: (payload: { listId: string | null; keyword: string; description: string; autoResponse: string; status: "Active" | "Inactive" }) => void;
  onCancel: () => void;
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label?: string }) {
  return (
    <div
      className={`toggle ${on ? "on" : ""}`}
      onClick={onClick}
      role="switch"
      aria-checked={on}
      aria-label={label}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
    />
  );
}

export default function KeywordEditor({ lists, keyword, onSave, onCancel }: Props) {
  const [kw, setKw] = useState(keyword.keyword);
  const [desc, setDesc] = useState(keyword.description);
  const [behaviorOpen, setBehaviorOpen] = useState(true);
  const [addToLists, setAddToLists] = useState(Boolean(keyword.listName));
  const [altResponse, setAltResponse] = useState(false);
  const [doubleOptIn, setDoubleOptIn] = useState(false);
  const [createsContact, setCreatesContact] = useState(true);
  const [active, setActive] = useState(keyword.status !== "Inactive");
  const [autoResponse, setAutoResponse] = useState(keyword.autoResponse ?? "Well howdy there! Show this text at the register to get a free sample of our signature scent.");
  const [selectedList, setSelectedList] = useState<string | null>(() => lists.find((l) => l.name === keyword.listName)?.id ?? null);
  const [listDrop, setListDrop] = useState(false);

  useEffect(() => {
    if (!listDrop) return;
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setListDrop(false);
    };
    document.addEventListener("keydown", keyHandler);
    return () => document.removeEventListener("keydown", keyHandler);
  }, [listDrop]);

  const selectedName = lists.find((l) => l.id === selectedList)?.name;
  const kwTrimmed = kw.trim();

  return (
    <div className="flex gap-10 pt-6">
      <div className="max-w-[620px] flex-1">
        <div className="breadcrumb">Tools / Keywords / <span>{keyword.keyword}</span></div>
        <h1 className="page-title"><MessageSquareText size={19} className="text-[#3b4ef5]" /> Edit Keyword</h1>
        <p className="page-subtitle mb-6">Edit your keyword and associated settings.</p>

        <div className="section-card mb-4">
          <div className="section-head">
            <span className="step-badge">1</span>
            Setup <ChevronDown size={14} className="ml-auto text-[#9aa3c0]" />
          </div>
          <div className="space-y-4 border-t border-[#f1f3f9] px-5 pt-4 pb-5">
            <div>
              <label className="field-label" htmlFor="kw-name">Keyword</label>
              <input id="kw-name" className="input" value={kw} onChange={(e) => setKw(e.target.value)} />
              {!kwTrimmed && <p className="mt-1.5 text-[12px] text-[#f04438]">Enter a keyword.</p>}
            </div>
            <div>
              <label className="field-label" htmlFor="kw-desc">Description</label>
              <input id="kw-desc" className="input" value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>
            <div>
              <label className="field-label flex justify-between" htmlFor="kw-auto">
                Auto Response <span className="font-normal text-[#9aa3c0]">{autoResponse.length}/918</span>
              </label>
              <textarea id="kw-auto" className="input h-[76px] resize-none" maxLength={918} value={autoResponse} onChange={(e) => setAutoResponse(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="section-card mb-6">
          <div
            className="section-head cursor-pointer hover:bg-[#fafbfe]"
            onClick={() => setBehaviorOpen(!behaviorOpen)}
            role="button"
            tabIndex={0}
            aria-expanded={behaviorOpen}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setBehaviorOpen(!behaviorOpen); } }}
          >
            <span className="step-badge">2</span>
            Contact Behavior <ChevronDown size={14} className={`ml-auto text-[#9aa3c0] transition-transform ${behaviorOpen ? "" : "-rotate-90"}`} />
          </div>
          {behaviorOpen && (
            <div className="space-y-5 border-t border-[#f1f3f9] px-5 pt-4 pb-5">
              <p className="rounded-lg border border-[#eceef5] bg-[#fafbfe] px-3 py-2 text-[12px] leading-relaxed text-[#7a85a8]">
                Only list assignment and auto-response are saved today. Other behavior options below are preview-only.
              </p>
              <div>
                <div className="mb-2 text-[13px] font-semibold text-[#0f1b3d]">Create a subscribed contact when someone texts this keyword?</div>
                <div className="seg-control">
                  {["Yes", "No"].map((o) => (
                    <button key={o} onClick={() => setCreatesContact(o === "Yes")} className={`seg-option ${(createsContact ? "Yes" : "No") === o ? "active" : ""}`}>
                      {o}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#0f1b3d]"><List size={13} className="text-[#7a85a8]" /> Add the contact to one or more lists</div>
                  <div className="mt-1 max-w-[380px] text-[12px] leading-relaxed text-[#7a85a8]">When a contact is created after texting this keyword, you can optionally add them to one or more lists.</div>
                </div>
                <Toggle on={addToLists} onClick={() => setAddToLists(!addToLists)} label="Add contact to lists" />
              </div>

              {addToLists && (
                <div className="relative">
                  <label className="field-label">Add to Lists</label>
                  <div
                    className="input flex min-h-[38px] cursor-pointer items-center gap-2"
                    onClick={() => setListDrop(!listDrop)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={listDrop}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setListDrop(!listDrop); } }}
                  >
                    {selectedName && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#eef1fe] px-2 py-0.5 text-[12px] font-semibold text-[#3b4ef5]">
                        {selectedName}
                        <X size={11} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelectedList(null); }} />
                      </span>
                    )}
                    {!selectedName && <span className="text-[#9aa3c0]">Select a list</span>}
                    <ChevronDown size={13} className="ml-auto text-[#9aa3c0]" />
                  </div>
                  {listDrop && (
                    <div className="menu-pop left-0 right-0 mt-1 max-h-[180px] overflow-y-auto" role="listbox">
                      {lists.map((l) => (
                        <button key={l.id} className="menu-item" role="option" aria-selected={selectedList === l.id} onClick={() => { setSelectedList(l.id); setListDrop(false); }}>
                          <List size={13} className="text-[#9aa3c0]" /> {l.name}
                          {selectedList === l.id && <Check size={13} className="ml-auto text-[#3b4ef5]" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[13px] font-semibold text-[#0f1b3d]">Send an alternate response to existing contacts</div>
                  <div className="mt-1 max-w-[380px] text-[12px] leading-relaxed text-[#7a85a8]">If someone who is already a contact texts this keyword, send a different message.</div>
                </div>
                <Toggle on={altResponse} onClick={() => setAltResponse(!altResponse)} label="Alternate response" />
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[13px] font-semibold text-[#0f1b3d]">Require double opt-in</div>
                  <div className="mt-1 max-w-[380px] text-[12px] leading-relaxed text-[#7a85a8]">New contacts must reply YES to confirm their subscription before receiving messages.</div>
                </div>
                <Toggle on={doubleOptIn} onClick={() => setDoubleOptIn(!doubleOptIn)} label="Double opt-in" />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            className="btn-primary"
            disabled={!kwTrimmed}
            onClick={() => onSave({ listId: addToLists ? selectedList : null, keyword: kwTrimmed, description: desc, autoResponse, status: active ? "Active" : "Inactive" })}
          >
            Save Keyword
          </button>
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <div className="ml-auto flex items-center gap-2 text-[12.5px] font-semibold text-[#0f1b3d]">
            {active ? "Active" : "Inactive"}
            <Toggle on={active} onClick={() => setActive(!active)} label="Keyword active" />
          </div>
        </div>
      </div>

      <div className="pt-[52px] hide-md">
        <div className="mb-2 text-center text-[12px] font-semibold text-[#9aa3c0]">Message Preview</div>
        <div className="phone-frame">
          <div className="flex items-center justify-between px-1 pb-3 text-[10px] text-[#9aa3c0]">
            <span>9:41</span>
            <span className="flex items-center gap-1"><Signal size={10} /><Wifi size={10} /><BatteryFull size={11} /></span>
          </div>
          <div className="rounded-xl bg-[#f7f8fc] px-3 py-2 mb-3">
            <div className="text-[10px] font-semibold text-[#9aa3c0]">Text Message</div>
            <div className="text-[11px] text-[#7a85a8]">To: Transovo Sandbox</div>
          </div>
          <div className="mb-2 ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-[#3b4ef5] px-3 py-2 text-[12px] leading-relaxed text-white">
            {kw || "Keyword"}
          </div>
          <div className="phone-bubble">{autoResponse}</div>
        </div>
      </div>
    </div>
  );
}
