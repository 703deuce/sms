"use client";
import { useState } from "react";
import { UserPlus, Lightbulb, X, ChevronDown } from "lucide-react";
import { contactLists } from "../mock-data";

const inputCls =
  "w-full px-3 h-10 border border-border rounded-lg text-[13px] bg-card text-foreground outline-none transition focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-muted-foreground";
const labelCls = "block text-[13px] font-medium text-foreground mb-1.5";
const sectionTitleCls = "text-[15px] font-semibold tracking-tight text-foreground";
const sectionDescCls = "text-[13px] text-muted-foreground mt-1 mb-4";

export default function CreateContact({
  onBack,
  onSaved,
}: {
  onBack: () => void;
  onSaved: (formData?: {
    firstName: string;
    lastName: string;
    mobile: string;
    email: string;
    optIn: string;
  }) => void | Promise<void>;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [listQuery, setListQuery] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [optIn, setOptIn] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const filteredLists = contactLists.filter(
    (l) => l.toLowerCase().includes(listQuery.toLowerCase()) && !selectedLists.includes(l)
  );

  return (
    <div className="px-8 pt-6 pb-10 max-w-6xl">
      <div className="text-xs text-muted-foreground mb-2">Contacts / Create Contact</div>
      <div className="flex items-center gap-2.5">
        <UserPlus className="w-5 h-5 text-foreground" />
        <h1 className="text-[22px] font-bold tracking-tight text-foreground">Create Contact</h1>
      </div>
      <p className="text-[13px] text-muted-foreground mt-1 mb-7">Create a new contact.</p>

      <div className="flex gap-10 items-start">
        <div className="flex-1 max-w-xl space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>First Name</label>
              <input className={inputCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Last Name</label>
              <input className={inputCls} value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Mobile Number</label>
            <input className={inputCls} value={mobile} onChange={(e) => setMobile(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Birthdate</label>
            <input className={inputCls} placeholder="mm/dd/yyyy" type="text" />
          </div>
          <div>
            <label className={labelCls}>Address</label>
            <input className={inputCls} placeholder="Enter a location" />
          </div>
          <div>
            <label className={labelCls}>City</label>
            <input className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>State / Province</label>
              <select className={inputCls}><option>None</option></select>
            </div>
            <div>
              <label className={labelCls}>Postal Code</label>
              <input className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Country</label>
              <select className={inputCls}><option>None</option></select>
            </div>
            <div>
              <label className={labelCls}>Timezone</label>
              <select className={inputCls}><option>None</option></select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Language</label>
            <select className={inputCls}><option>None</option></select>
          </div>

          <div className="pt-4">
            <h3 className={sectionTitleCls}>Custom Fields</h3>
            <p className={sectionDescCls}>
              Custom fields allow you to store custom data on your contacts. You can manage your custom fields{" "}
              <span className="text-primary font-medium cursor-pointer hover:underline">here</span>.
            </p>
            <div className="space-y-4">
              <div><label className={labelCls}>Favorite Sports Team</label><input className={inputCls} /></div>
              <div><label className={labelCls}>Graduation Year</label><input className={inputCls} /></div>
              <div><label className={labelCls}>Preferred Location</label><input className={inputCls} /></div>
            </div>
          </div>

          <div className="pt-4">
            <h3 className={sectionTitleCls}>Lists</h3>
            <p className={sectionDescCls}>
              Select one or more optional lists for this contact to be on. You can manage your contact lists{" "}
              <span className="text-primary font-medium cursor-pointer hover:underline">here</span>.
            </p>
            <div className="relative">
              <div
                className="flex flex-wrap items-center gap-1.5 border border-border rounded-lg px-2 py-1.5 min-h-10 cursor-text bg-card transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
                onClick={() => setListOpen(true)}
              >
                {selectedLists.map((l) => (
                  <span key={l} className="flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium pl-2.5 pr-1.5 py-1 rounded-md">
                    {l}
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedLists(selectedLists.filter((x) => x !== l)); }}
                      className="hover:bg-primary/15 rounded p-0.5 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  className="flex-1 min-w-[90px] text-[13px] outline-none bg-transparent px-1 py-1 placeholder:text-muted-foreground"
                  placeholder="Search"
                  value={listQuery}
                  onChange={(e) => { setListQuery(e.target.value); setListOpen(true); }}
                />
              </div>
              {listOpen && filteredLists.length > 0 && (
                <div className="kc-menu absolute z-20 w-full mt-1 max-h-44 overflow-y-auto py-1.5">
                  {filteredLists.map((l) => (
                    <button
                      key={l}
                      onClick={() => { setSelectedLists([...selectedLists, l]); setListQuery(""); }}
                      className="w-full text-left px-3.5 py-2 text-[13px] text-foreground hover:bg-accent transition-colors"
                    >
                      {l}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="pt-4">
            <h3 className={sectionTitleCls}>Opt-In Status</h3>
            <p className={sectionDescCls}>
              A contact's opt-in status determines whether or not they can receive campaigns, automated, and inbox
              messages from you. You can learn more about each opt-in status{" "}
              <span className="text-primary font-medium cursor-pointer hover:underline">here</span>.
            </p>
            <div className="relative">
              <select className={inputCls + " appearance-none pr-9"} value={optIn} onChange={(e) => setOptIn(e.target.value)}>
                <option value="">Select a Status...</option>
                <option>Not Subscribed</option>
                <option>Subscribed</option>
                <option>Unsubscribed</option>
                <option>Blocked</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-3 text-muted-foreground pointer-events-none" />
            </div>
            {optIn === "Subscribed" && (
              <label className="flex items-start gap-2.5 mt-3 text-xs text-muted-foreground leading-relaxed cursor-pointer">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="kc-check mt-0.5" />
                <span>
                  I confirm that this contact has consented to receive text messages from my brand in compliance with the
                  Transovo <span className="text-primary font-medium">Terms of Use</span> and <span className="text-primary font-medium">Anti-Spam Policy</span>,
                  recognizes the sender, and expect to receive said messages from them.
                </span>
              </label>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() =>
                void onSaved({
                  firstName,
                  lastName,
                  mobile,
                  email,
                  optIn: optIn || "Subscribed",
                })
              }
              className="kc-btn-primary px-12 h-10 text-[13px]"
            >
              Save
            </button>
            <button onClick={onBack} className="kc-btn-secondary px-12 h-10 text-[13px]">
              Back
            </button>
          </div>
        </div>

        <aside className="w-[300px] shrink-0 bg-primary/[0.04] border border-primary/10 rounded-xl p-5 sticky top-8">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <Lightbulb className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-foreground mb-1">Need to add multiple contacts?</div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-2">You can easily upload a list using our import tool.</p>
              <span className="text-xs text-primary font-semibold cursor-pointer hover:underline">Import a List</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
