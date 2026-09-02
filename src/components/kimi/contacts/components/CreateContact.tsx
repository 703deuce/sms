"use client";
import { useState } from "react";
import { UserPlus, Lightbulb, X, ChevronDown } from "lucide-react";
import { contactLists as defaultContactLists } from "../mock-data";

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-[13px] text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30";
const labelCls = "mb-1.5 block text-[13px] font-medium text-foreground";
const sectionTitleCls = "font-display text-[15px] font-semibold tracking-tight text-foreground";
const sectionDescCls = "mb-4 mt-1 text-[13px] leading-relaxed text-muted-foreground";

export default function CreateContact({
  onBack,
  onSaved,
  contactLists = defaultContactLists,
}: {
  onBack: () => void;
  onSaved: (formData?: {
    firstName: string;
    lastName: string;
    mobile: string;
    email: string;
    optIn: string;
    selectedLists?: string[];
  }) => void | Promise<void>;
  contactLists?: string[];
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
    <div className="max-w-6xl px-8 pb-10 pt-6">
      <div className="mb-2 text-xs text-muted-foreground">Contacts / <span className="text-foreground">Create Contact</span></div>
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <UserPlus className="h-4 w-4" />
        </span>
        <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground">Create Contact</h1>
      </div>
      <p className="mb-7 mt-1 text-[13px] text-muted-foreground">Create a new contact.</p>

      <div className="flex items-start gap-10">
        <div className="max-w-xl flex-1 space-y-5">
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

          <div className="border-t border-border pt-6">
            <h3 className={sectionTitleCls}>Custom Fields</h3>
            <p className={sectionDescCls}>
              Custom fields allow you to store custom data on your contacts. You can manage your custom fields{" "}
              <span className="cursor-pointer font-medium text-primary hover:underline">here</span>.
            </p>
            <div className="space-y-4">
              <div><label className={labelCls}>Favorite Sports Team</label><input className={inputCls} /></div>
              <div><label className={labelCls}>Graduation Year</label><input className={inputCls} /></div>
              <div><label className={labelCls}>Preferred Location</label><input className={inputCls} /></div>
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <h3 className={sectionTitleCls}>Lists</h3>
            <p className={sectionDescCls}>
              Select one or more optional lists for this contact to be on. You can manage your contact lists{" "}
              <span className="cursor-pointer font-medium text-primary hover:underline">here</span>.
            </p>
            <div className="relative">
              <div
                className="flex min-h-10 cursor-text flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/30"
                onClick={() => setListOpen(true)}
              >
                {selectedLists.map((l) => (
                  <span key={l} className="flex items-center gap-1 rounded-md bg-primary/10 py-1 pl-2.5 pr-1.5 text-xs font-medium text-primary">
                    {l}
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedLists(selectedLists.filter((x) => x !== l)); }}
                      className="rounded p-0.5 transition-colors hover:bg-primary/15"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  className="min-w-[90px] flex-1 bg-transparent px-1 py-1 text-[13px] outline-none placeholder:text-muted-foreground"
                  placeholder="Search lists…"
                  value={listQuery}
                  onChange={(e) => { setListQuery(e.target.value); setListOpen(true); }}
                />
              </div>
              {listOpen && filteredLists.length > 0 && (
                <div className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-lg border border-border bg-card py-1.5 shadow-lg animate-in fade-in zoom-in-95 duration-100">
                  {filteredLists.map((l) => (
                    <button
                      key={l}
                      onClick={() => { setSelectedLists([...selectedLists, l]); setListQuery(""); }}
                      className="w-full px-3.5 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-muted"
                    >
                      {l}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <h3 className={sectionTitleCls}>Opt-In Status</h3>
            <p className={sectionDescCls}>
              A contact's opt-in status determines whether or not they can receive campaigns, automated, and inbox
              messages from you. You can learn more about each opt-in status{" "}
              <span className="cursor-pointer font-medium text-primary hover:underline">here</span>.
            </p>
            <div className="relative">
              <select className={inputCls + " appearance-none pr-9"} value={optIn} onChange={(e) => setOptIn(e.target.value)}>
                <option value="">Select a Status...</option>
                <option>Not Subscribed</option>
                <option>Subscribed</option>
                <option>Unsubscribed</option>
                <option>Blocked</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            </div>
            {optIn === "Subscribed" && (
              <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="kc-check mt-0.5" />
                <span>
                  I confirm that this contact has consented to receive text messages from my brand in compliance with the
                  Transovo <span className="font-medium text-primary">Terms of Use</span> and <span className="font-medium text-primary">Anti-Spam Policy</span>,
                  recognizes the sender, and expects to receive said messages from them.
                </span>
              </label>
            )}
          </div>

          <div className="flex gap-3 border-t border-border pt-6">
            <button
              onClick={() =>
                void onSaved({
                  firstName,
                  lastName,
                  mobile,
                  email,
                  optIn: optIn || "Subscribed",
                  selectedLists,
                })
              }
              className="h-10 rounded-lg bg-primary px-10 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary-hover active:scale-[0.98]"
            >
              Save
            </button>
            <button
              onClick={onBack}
              className="h-10 rounded-lg border border-border bg-card px-10 text-[13px] font-semibold text-foreground shadow-sm transition-colors hover:bg-muted/60"
            >
              Back
            </button>
          </div>
        </div>

        <aside className="sticky top-8 w-[300px] shrink-0 rounded-xl border border-primary/10 bg-primary/[0.04] p-5">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
              <Lightbulb className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <div className="mb-1 text-[13px] font-semibold text-foreground">Need to add multiple contacts?</div>
              <p className="mb-2 text-xs leading-relaxed text-muted-foreground">You can easily upload a list using our import tool.</p>
              <span className="cursor-pointer text-xs font-semibold text-primary hover:underline">Import a List</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
