"use client";
import { useState } from "react";
import { ChevronDown, X, MessageSquareText } from "lucide-react";
import { ContactList, keywordDetail } from "../mock-data";

interface Props {
  lists: ContactList[];
  onSave: (listId: string | null) => void;
  onCancel: () => void;
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <div className={`toggle ${on ? "on" : ""}`} onClick={onClick} />;
}

export default function KeywordEditor({ lists, onSave, onCancel }: Props) {
  const [behaviorOpen, setBehaviorOpen] = useState(true);
  const [addToLists, setAddToLists] = useState(false);
  const [altResponse, setAltResponse] = useState(false);
  const [doubleOptIn, setDoubleOptIn] = useState(false);
  const [createsContact, setCreatesContact] = useState(true);
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [listDrop, setListDrop] = useState(false);

  const selectedName = lists.find((l) => l.id === selectedList)?.name;

  return (
    <div className="p-8 flex gap-8 max-w-[1100px]">
      <div className="flex-1 max-w-[620px]">
        <div className="text-[11.5px] text-[#9aa3c0] mb-2">Tools / Keywords / <span className="text-[#44507a]">NashVIP</span></div>
        <h1 className="flex items-center gap-2 text-[20px] font-bold text-[#0f1b3d]">
          <MessageSquareText size={20} className="text-[#3b4ef5]" /> Edit Keyword
        </h1>
        <p className="text-[13px] text-[#7a85a8] mt-0.5 mb-6">Edit your keyword and associated settings.</p>

        {/* Setup section */}
        <div className="border border-[#eceef5] rounded-xl bg-white mb-4">
          <div className="flex items-center gap-2 px-5 py-3.5 cursor-pointer font-semibold text-[13.5px] text-[#0f1b3d]">
            <span className="w-5 h-5 rounded-full bg-[#3b4ef5] text-white text-[11px] flex items-center justify-center">1</span>
            Setup <ChevronDown size={14} className="ml-auto text-[#9aa3c0]" />
          </div>
          <div className="px-5 pb-5 space-y-4 border-t border-[#f1f3f9] pt-4">
            <div>
              <label className="block text-[12px] font-semibold text-[#0f1b3d] mb-1.5">Keyword</label>
              <input className="input" defaultValue={keywordDetail.keyword} />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#0f1b3d] mb-1.5">Description</label>
              <input className="input" defaultValue={keywordDetail.description} />
            </div>
            <div>
              <label className="flex justify-between text-[12px] font-semibold text-[#0f1b3d] mb-1.5">
                Auto Response <span className="text-[#9aa3c0] font-normal">64/918</span>
              </label>
              <textarea className="input h-[76px] resize-none" defaultValue={keywordDetail.autoResponse} />
            </div>
          </div>
        </div>

        {/* Contact Behavior section */}
        <div className="border border-[#eceef5] rounded-xl bg-white mb-6">
          <div className="flex items-center gap-2 px-5 py-3.5 cursor-pointer font-semibold text-[13.5px] text-[#0f1b3d]" onClick={() => setBehaviorOpen(!behaviorOpen)}>
            <span className="w-5 h-5 rounded-full bg-[#3b4ef5] text-white text-[11px] flex items-center justify-center">2</span>
            Contact Behavior <ChevronDown size={14} className={`ml-auto text-[#9aa3c0] transition-transform ${behaviorOpen ? "" : "-rotate-90"}`} />
          </div>
          {behaviorOpen && (
            <div className="px-5 pb-5 border-t border-[#f1f3f9] pt-4 space-y-5">
              <div>
                <div className="text-[13px] font-semibold text-[#0f1b3d] mb-2">Create a subscribed contact when someone texts this keyword?</div>
                <div className="flex rounded-lg border border-[#e2e6f0] overflow-hidden w-fit">
                  {["Yes", "No"].map((o) => (
                    <button
                      key={o}
                      onClick={() => setCreatesContact(o === "Yes")}
                      className={`px-10 py-2 text-[13px] font-medium ${(createsContact ? "Yes" : "No") === o ? "bg-white shadow-sm border border-[#e2e6f0] rounded-lg m-0.5 text-[#0f1b3d]" : "bg-[#f6f7fb] text-[#7a85a8]"}`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[13px] font-semibold text-[#0f1b3d]">☰ Add the contact to one or more lists</div>
                  <div className="text-[12px] text-[#7a85a8] mt-1 max-w-[380px]">When a contact is created after texting this keyword, you can optionally add them to one or more lists.</div>
                </div>
                <Toggle on={addToLists} onClick={() => setAddToLists(!addToLists)} />
              </div>

              {addToLists && (
                <div className="relative">
                  <label className="block text-[12px] font-semibold text-[#0f1b3d] mb-1.5">Add to Lists</label>
                  <div className="input flex items-center gap-2 cursor-pointer min-h-[38px]" onClick={() => setListDrop(!listDrop)}>
                    {selectedName && (
                      <span className="flex items-center gap-1 bg-[#eef1fe] text-[#3b4ef5] text-[11.5px] font-semibold rounded-md px-2 py-1">
                        {selectedName}
                        <X size={11} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelectedList(null); }} />
                      </span>
                    )}
                    <span className="text-[#9aa3c0] text-[13px]">{selectedName ? "" : "Search"}</span>
                  </div>
                  {listDrop && (
                    <div className="absolute z-20 w-full bg-white border border-[#eceef5] rounded-xl shadow-lg mt-1 py-1">
                      {lists.map((l) => (
                        <div
                          key={l.id}
                          className="flex items-center gap-2 px-3.5 py-2.5 text-[13px] text-[#0f1b3d] hover:bg-[#f6f7fb] cursor-pointer"
                          onClick={() => { setSelectedList(l.id); setListDrop(false); }}
                        >
                          <span className="text-[#9aa3c0]">☰</span> {l.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[13px] font-semibold text-[#0f1b3d]">Send an alternate response if a contact exists</div>
                  <div className="text-[12px] text-[#7a85a8] mt-1 max-w-[380px]">If a person already exists as a contact when texting this keyword, you have the option to send a different auto-response than what's specified above. This is optional.</div>
                </div>
                <Toggle on={altResponse} onClick={() => setAltResponse(!altResponse)} />
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[13px] font-semibold text-[#0f1b3d]">Require Double Opt-In</div>
                  <div className="text-[12px] text-[#7a85a8] mt-1 max-w-[380px]">When enabled, after someone texts your keyword, they'll receive a message asking them to confirm before subscribing.</div>
                </div>
                <Toggle on={doubleOptIn} onClick={() => setDoubleOptIn(!doubleOptIn)} />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button className="btn-primary" onClick={() => onSave(addToLists ? selectedList : null)}>Save</button>
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        </div>
      </div>

      {/* Message preview phone */}
      <div className="shrink-0 pt-16">
        <div className="text-[11px] font-semibold text-[#7a85a8] bg-[#eef1fe] rounded-md px-2.5 py-1 w-fit mb-3">Message Preview</div>
        <div className="phone-frame">
          <div className="bubble-out">NashVIP</div>
          <div className="bubble-in">{keywordDetail.autoResponse}</div>
          <div className="bubble-in text-[9.5px] text-[#7a85a8]">
            Msg & data rates may apply. Msg frequency varies. Reply HELP for help, STOP to cancel. Terms & Privacy: s.trnsvo.io/tos
          </div>
        </div>
      </div>
    </div>
  );
}
