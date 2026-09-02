"use client";
import { useRef, useState } from "react";
import { ChevronDown, X, MessageSquareText, List, Wifi, Signal, BatteryFull } from "lucide-react";
import { ContactList, keywordDetail } from "../mock-data";

interface Props {
  lists: ContactList[];
  keywordId?: string;
  initialKeyword?: string;
  initialDescription?: string;
  initialAutoResponse?: string;
  initialListName?: string;
  initialStatus?: "Active" | "Inactive";
  onSave: (payload: {
    listId: string | null;
    keyword: string;
    description: string;
    autoResponse: string;
    status: "Active" | "Inactive";
  }) => void;
  onCancel: () => void;
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <div className={`toggle ${on ? "on" : ""} transition-colors`} onClick={onClick} />;
}

export default function KeywordEditor({ lists, keywordId: _keywordId, initialKeyword, initialDescription, initialAutoResponse, initialListName, initialStatus, onSave, onCancel }: Props) {
  const keywordRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);
  const autoResponseRef = useRef<HTMLTextAreaElement>(null);
  const [behaviorOpen, setBehaviorOpen] = useState(true);
  const [addToLists, setAddToLists] = useState(Boolean(initialListName));
  const [altResponse, setAltResponse] = useState(false);
  const [doubleOptIn, setDoubleOptIn] = useState(false);
  const [createsContact, setCreatesContact] = useState(true);
  const [active, setActive] = useState(initialStatus !== "Inactive");
  const [autoResponse, setAutoResponse] = useState(initialAutoResponse ?? keywordDetail.autoResponse);
  const [selectedList, setSelectedList] = useState<string | null>(
    () => lists.find((l) => l.name === initialListName)?.id ?? null,
  );
  const [listDrop, setListDrop] = useState(false);

  const selectedName = lists.find((l) => l.id === selectedList)?.name;

  return (
    <div className="flex gap-10 pt-6">
      <div className="max-w-[620px] flex-1">
        <div className="breadcrumb">Tools / Keywords / <span>NashVIP</span></div>
        <h1 className="page-title"><MessageSquareText size={19} className="text-[#3b4ef5]" /> Edit Keyword</h1>
        <p className="page-subtitle mb-6">Edit your keyword and associated settings.</p>

        {/* Setup section */}
        <div className="section-card mb-4">
          <div className="section-head">
            <span className="step-badge">1</span>
            Setup <ChevronDown size={14} className="ml-auto text-[#9aa3c0]" />
          </div>
          <div className="space-y-4 border-t border-[#f1f3f9] px-5 pt-4 pb-5">
            <div>
              <label className="field-label">Keyword</label>
              <input ref={keywordRef} className="input" defaultValue={initialKeyword ?? keywordDetail.keyword} />
            </div>
            <div>
              <label className="field-label">Description</label>
              <input ref={descriptionRef} className="input" defaultValue={initialDescription ?? keywordDetail.description} />
            </div>
            <div>
              <label className="field-label flex justify-between">
                Auto Response <span className="font-normal text-[#9aa3c0]">64/918</span>
              </label>
              <textarea
                ref={autoResponseRef}
                className="input h-[76px] resize-none"
                value={autoResponse}
                onChange={(e) => setAutoResponse(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Contact Behavior section */}
        <div className="section-card mb-6">
          <div className="section-head cursor-pointer transition-colors hover:bg-[#fafbfe]" onClick={() => setBehaviorOpen(!behaviorOpen)}>
            <span className="step-badge">2</span>
            Contact Behavior <ChevronDown size={14} className={`ml-auto text-[#9aa3c0] transition-transform ${behaviorOpen ? "" : "-rotate-90"}`} />
          </div>
          {behaviorOpen && (
            <div className="space-y-5 border-t border-[#f1f3f9] px-5 pt-4 pb-5">
              <div>
                <div className="mb-2 text-[13px] font-semibold text-[#0f1b3d]">Create a subscribed contact when someone texts this keyword?</div>
                <div className="seg-control">
                  {["Yes", "No"].map((o) => (
                    <button
                      key={o}
                      onClick={() => setCreatesContact(o === "Yes")}
                      className={`seg-option transition-all ${(createsContact ? "Yes" : "No") === o ? "active" : ""}`}
                    >
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
                <Toggle on={addToLists} onClick={() => setAddToLists(!addToLists)} />
              </div>

              {addToLists && (
                <div className="relative">
                  <label className="field-label">Add to Lists</label>
                  <div className="input flex min-h-[38px] cursor-pointer items-center gap-2" onClick={() => setListDrop(!listDrop)}>
                    {selectedName && (
                      <span className="chip">
                        {selectedName}
                        <X size={11} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelectedList(null); }} />
                      </span>
                    )}
                    <span className="text-[13px] text-[#9aa3c0]">{selectedName ? "" : "Search"}</span>
                  </div>
                  {listDrop && (
                    <div className="menu-pop mt-1 w-full">
                      {lists.map((l) => (
                        <div
                          key={l.id}
                          className="menu-item"
                          onClick={() => { setSelectedList(l.id); setListDrop(false); }}
                        >
                          <List size={13} className="text-[#9aa3c0]" /> {l.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[13px] font-semibold text-[#0f1b3d]">Send an alternate response if a contact exists</div>
                  <div className="mt-1 max-w-[380px] text-[12px] leading-relaxed text-[#7a85a8]">If a person already exists as a contact when texting this keyword, you have the option to send a different auto-response than what's specified above. This is optional.</div>
                </div>
                <Toggle on={altResponse} onClick={() => setAltResponse(!altResponse)} />
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[13px] font-semibold text-[#0f1b3d]">Require Double Opt-In</div>
                  <div className="mt-1 max-w-[380px] text-[12px] leading-relaxed text-[#7a85a8]">When enabled, after someone texts your keyword, they'll receive a message asking them to confirm before subscribing.</div>
                </div>
                <Toggle on={doubleOptIn} onClick={() => setDoubleOptIn(!doubleOptIn)} />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Toggle on={active} onClick={() => setActive(!active)} />
            <span className="text-[13px] font-medium text-[#0f1b3d]">{active ? "Active" : "Inactive"}</span>
          </div>
          <div className="flex gap-3">
            <button
              className="btn-primary"
              onClick={() =>
                onSave({
                  listId: addToLists ? selectedList : null,
                  keyword: keywordRef.current?.value ?? initialKeyword ?? "",
                  description: descriptionRef.current?.value ?? initialDescription ?? "",
                  autoResponse: autoResponseRef.current?.value ?? autoResponse,
                  status: active ? "Active" : "Inactive",
                })
              }
            >
              Save
            </button>
            <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          </div>
        </div>
      </div>

      {/* Message preview phone */}
      <div className="sticky top-6 shrink-0 self-start pt-14">
        <div className="mb-3 w-fit rounded-md bg-[#eef1fe] px-2.5 py-1 text-[11px] font-semibold text-[#3b4ef5]">Message Preview</div>
        <div className="phone-frame">
          <div className="phone-notch" />
          <div className="phone-status">
            <span className="text-[9px] font-semibold">9:41</span>
            <span className="flex items-center gap-1 text-[#0f1b3d]"><Signal size={9} /><Wifi size={9} /><BatteryFull size={10} /></span>
          </div>
          <div className="phone-thread">
            <div className="bubble-out">{initialKeyword ?? keywordDetail.keyword}</div>
            <div className="bubble-in">{autoResponse}</div>
            <div className="bubble-in text-[9px] leading-relaxed text-[#8a93b5]">
              Msg & data rates may apply. Msg frequency varies. Reply HELP for help, STOP to cancel. Terms & Privacy: s.trnsvo.io/tos
            </div>
          </div>
          <div className="phone-input">
            <span className="text-[10px] text-[#9aa3c0]">Text Message</span>
            <span className="phone-send">↑</span>
          </div>
        </div>
      </div>
    </div>
  );
}
