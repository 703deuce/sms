"use client";
import { useState } from "react";
import { UserPlus, Lightbulb, X, ChevronDown } from "lucide-react";
import { contactLists } from "../mock-data";

const inputCls =
  "w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-card text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-muted-foreground";
const labelCls = "block text-sm font-medium text-foreground mb-1.5";

export default function CreateContact({
  onBack,
  onSaved,
}: {
  onBack: () => void;
  onSaved: () => void;
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
    <div className="p-8 max-w-5xl">
      <div className="text-xs text-muted-foreground mb-2">Contacts / Create Contact</div>
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <UserPlus className="w-5 h-5 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Create Contact</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6 ml-12">Create a new contact.</p>

      <div className="flex gap-8 items-start">
        <div className="flex-1 space-y-5">
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

          <div className="pt-2">
            <h3 className="text-base font-semibold text-foreground">Custom Fields</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Custom fields allow you to store custom data on your contacts. You can manage your custom fields{" "}
              <span className="text-primary cursor-pointer">here</span>.
            </p>
            <div className="space-y-4">
              <div><label className={labelCls}>Favorite Sports Team</label><input className={inputCls} /></div>
              <div><label className={labelCls}>Graduation Year</label><input className={inputCls} /></div>
              <div><label className={labelCls}>Preferred Location</label><input className={inputCls} /></div>
            </div>
          </div>

          <div className="pt-2">
            <h3 className="text-base font-semibold text-foreground">Lists</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Select one or more optional lists for this contact to be on. You can manage your contact lists{" "}
              <span className="text-primary cursor-pointer">here</span>.
            </p>
            <div
              className="flex flex-wrap items-center gap-1.5 border border-border rounded-lg px-2 py-1.5 cursor-text"
              onClick={() => setListOpen(true)}
            >
              {selectedLists.map((l) => (
                <span key={l} className="flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2 py-1 rounded-md">
                  {l}
                  <button onClick={(e) => { e.stopPropagation(); setSelectedLists(selectedLists.filter((x) => x !== l)); }}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                className="flex-1 min-w-[90px] text-sm outline-none bg-transparent px-1 py-1"
                placeholder="Search"
                value={listQuery}
                onChange={(e) => { setListQuery(e.target.value); setListOpen(true); }}
              />
            </div>
            {listOpen && (
              <div className="border border-border rounded-lg mt-1 bg-card shadow-lg max-h-44 overflow-y-auto py-1">
                {filteredLists.map((l) => (
                  <button
                    key={l}
                    onClick={() => { setSelectedLists([...selectedLists, l]); setListQuery(""); }}
                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent flex items-center gap-2"
                  >
                    <span className="text-muted-foreground">☰</span> {l}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2">
            <h3 className="text-base font-semibold text-foreground">Opt-In Status</h3>
            <p className="text-sm text-muted-foreground mb-3">
              A contact's opt-in status determines whether or not they can receive campaigns, automated, and inbox
              messages from you. You can learn more about each opt-in status{" "}
              <span className="text-primary cursor-pointer">here</span>.
            </p>
            <div className="relative">
              <select className={inputCls + " appearance-none"} value={optIn} onChange={(e) => setOptIn(e.target.value)}>
                <option value="">Select a Status...</option>
                <option>Not Subscribed</option>
                <option>Subscribed</option>
                <option>Unsubscribed</option>
                <option>Blocked</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-3.5 text-muted-foreground pointer-events-none" />
            </div>
            {optIn === "Subscribed" && (
              <label className="flex items-start gap-2 mt-3 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 rounded" />
                <span>
                  I confirm that this contact has consented to receive text messages from my brand in compliance with the
                  Transovo <span className="text-primary">Terms of Use</span> and <span className="text-primary">Anti-Spam Policy</span>,
                  recognizes the sender, and expect to receive said messages from them.
                </span>
              </label>
            )}
          </div>

          <div className="flex gap-3 pt-2 pb-8">
            <button
              onClick={onSaved}
              className="px-10 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
            >
              Save
            </button>
            <button onClick={onBack} className="px-10 py-2.5 rounded-lg border border-border text-sm font-semibold text-foreground hover:bg-accent">
              Back
            </button>
          </div>
        </div>

        <div className="w-80 shrink-0 bg-primary/5 border border-primary/10 rounded-xl p-5 sticky top-8">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <Lightbulb className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground mb-1">Need to add multiple contacts?</div>
              <p className="text-xs text-muted-foreground mb-2">You can easily upload a list using our import tool.</p>
              <span className="text-xs text-primary font-medium cursor-pointer">Import a List</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
