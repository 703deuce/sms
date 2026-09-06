"use client";

import { useState } from "react";
import { UserPlus, Lightbulb, X, ChevronDown, Loader2 } from "lucide-react";
import { contactLists as defaultContactLists } from "../mock-data";

const inputCls =
  "h-10 w-full rounded-[10px] border border-border bg-card px-3 text-[13px] text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition-colors placeholder:text-muted-foreground/80 hover:border-border focus:border-primary focus:ring-2 focus:ring-ring/30";
const labelCls = "mb-1.5 block text-[13px] font-semibold tracking-tight text-foreground/90";
const sectionTitleCls = "font-display text-[15px] font-semibold tracking-tight text-foreground";
const sectionDescCls = "mb-4 mt-1 text-[13px] leading-relaxed text-muted-foreground";
const checkCls = "kc-check h-4 w-4 rounded border-border";

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
  const [saving, setSaving] = useState(false);

  const filteredLists = contactLists.filter(
    (l) => l.toLowerCase().includes(listQuery.toLowerCase()) && !selectedLists.includes(l),
  );

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSaved({
        firstName,
        lastName,
        mobile,
        email,
        optIn: optIn || "Subscribed",
        selectedLists,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 pb-12 pt-7 lg:px-8">
      <nav className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <button type="button" onClick={onBack} className="transition-colors hover:text-foreground">
          Contacts
        </button>
        <span>/</span>
        <span className="font-medium text-foreground">Create Contact</span>
      </nav>
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <UserPlus className="h-4 w-4" />
        </span>
        <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground">Create Contact</h1>
      </div>
      <p className="mb-7 mt-1 text-[13px] text-muted-foreground">Create a new contact.</p>

      <div className="flex items-start gap-8">
        <div className="max-w-xl flex-1">
          <div className="rounded-xl border border-border bg-card p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls} htmlFor="cc-first">First Name</label>
                  <input id="cc-first" className={inputCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="cc-last">Last Name</label>
                  <input id="cc-last" className={inputCls} value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
              <div>
                <label className={labelCls} htmlFor="cc-mobile">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <input
                  id="cc-mobile"
                  className={inputCls}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="(555) 000-0000"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="cc-email">Email</label>
                <input id="cc-email" className={inputCls} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label className={labelCls} htmlFor="cc-birthdate">Birthdate</label>
                <input id="cc-birthdate" className={inputCls} placeholder="mm/dd/yyyy" type="text" />
              </div>
              <div>
                <label className={labelCls} htmlFor="cc-address">Address</label>
                <input id="cc-address" className={inputCls} placeholder="Enter a location" autoComplete="street-address" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls} htmlFor="cc-city">City</label>
                  <input id="cc-city" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="cc-state">State / Province</label>
                  <select id="cc-state" className={inputCls}>
                    <option>None</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls} htmlFor="cc-postal">Postal Code</label>
                  <input id="cc-postal" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="cc-country">Country</label>
                  <select id="cc-country" className={inputCls}>
                    <option>None</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls} htmlFor="cc-tz">Timezone</label>
                  <select id="cc-tz" className={inputCls}>
                    <option>None</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls} htmlFor="cc-lang">Language</label>
                  <select id="cc-lang" className={inputCls}>
                    <option>None</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Custom fields */}
            <div className="mt-7 border-t border-border pt-6">
              <h3 className={sectionTitleCls}>Custom Fields</h3>
              <p className={sectionDescCls}>
                Custom fields allow you to store customer-specific details on a contact. They can be used for
                segmentation and personalization.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Preferred Location</label>
                  <select className={inputCls}>
                    <option>None</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Favorite Sports Team</label>
                  <input className={inputCls} />
                </div>
              </div>
            </div>

            {/* Lists */}
            <div className="mt-7 border-t border-border pt-6">
              <h3 className={sectionTitleCls}>Lists</h3>
              <p className={sectionDescCls}>Organize this contact by adding them to one or more lists.</p>
              <div className="relative">
                <div
                  className="flex min-h-10 w-full cursor-text flex-wrap items-center gap-1.5 rounded-[10px] border border-border bg-card px-2.5 py-1.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/30"
                  onClick={() => setListOpen(true)}
                >
                  {selectedLists.map((l) => (
                    <span
                      key={l}
                      className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[12px] font-medium text-primary"
                    >
                      {l}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLists(selectedLists.filter((x) => x !== l));
                        }}
                        className="rounded p-0.5 hover:bg-primary/15"
                        aria-label={`Remove ${l}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    value={listQuery}
                    onChange={(e) => {
                      setListQuery(e.target.value);
                      setListOpen(true);
                    }}
                    onFocus={() => setListOpen(true)}
                    placeholder={selectedLists.length === 0 ? "Search lists" : ""}
                    className="min-w-[100px] flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/80"
                  />
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${listOpen ? "rotate-180" : ""}`} />
                </div>
                {listOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setListOpen(false)} />
                    <div className="kc-scroll absolute z-20 mt-1.5 max-h-52 w-full overflow-y-auto rounded-xl border border-border bg-card py-1.5 shadow-[0_8px_24px_rgba(16,24,40,0.12)] animate-in fade-in zoom-in-95">
                      {filteredLists.map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => {
                            setSelectedLists([...selectedLists, l]);
                            setListQuery("");
                          }}
                          className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
                        >
                          {l}
                        </button>
                      ))}
                      {filteredLists.length === 0 && (
                        <p className="px-3.5 py-3 text-[12px] text-muted-foreground">No lists match.</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Opt-in */}
            <div className="mt-7 border-t border-border pt-6">
              <h3 className={sectionTitleCls}>
                Opt-In Status <span className="text-rose-500">*</span>
              </h3>
              <p className={sectionDescCls}>
                Set the contact&rsquo;s messaging opt-in status. This controls whether appointment reminders and other
                messages can be sent to them.
              </p>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Opt-in status">
                {["Subscribed", "Not Subscribed", "Unsubscribed"].map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={optIn === v}
                    onClick={() => setOptIn(v)}
                    className={`h-10 rounded-[10px] border text-[13px] font-medium transition-all ${
                      optIn === v
                        ? "border-primary bg-primary/5 text-primary ring-2 ring-ring/30"
                        : "border-border bg-card text-foreground hover:bg-muted"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              {optIn === "Subscribed" && (
                <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-3">
                  <input
                    type="checkbox"
                    className={`${checkCls} mt-0.5`}
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  <span className="text-[12px] leading-relaxed text-muted-foreground">
                    I confirm this contact has agreed to receive text messages from our business, and I understand
                    consent can be withdrawn at any time.
                  </span>
                </label>
              )}
            </div>

            <div className="mt-7 flex items-center justify-end gap-2 border-t border-border pt-5">
              <button
                type="button"
                onClick={onBack}
                className="h-10 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || !mobile.trim() || (optIn === "Subscribed" && !confirmed)}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-5 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Contact
              </button>
            </div>
          </div>
        </div>

        {/* Tip panel */}
        <aside className="sticky top-8 hidden w-72 shrink-0 lg:block">
          <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 p-5">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <Lightbulb className="h-4 w-4" />
              </span>
              <h3 className="text-[13px] font-semibold text-amber-900">Helpful tips</h3>
            </div>
            <ul className="space-y-2.5 text-[12px] leading-relaxed text-amber-900/80">
              <li>Only a mobile number is required — everything else can be added later from the contact profile.</li>
              <li>Contacts marked Subscribed can receive appointment reminders and messages right away.</li>
              <li>Adding contacts to lists makes it easier to segment and find them later.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
