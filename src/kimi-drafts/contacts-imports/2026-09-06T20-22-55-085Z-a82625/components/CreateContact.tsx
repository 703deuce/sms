"use client";
import { useState } from "react";
import { UserPlus, ChevronDown, X, Loader2 } from "lucide-react";
import { contactLists as defaultContactLists } from "../mock-data";

const labelCls = "mb-1.5 block text-[13px] font-semibold tracking-tight text-foreground/90";
const sectionTitleCls = "font-display text-[15px] font-semibold tracking-tight text-foreground";
const sectionDescCls = "mb-4 mt-1 text-[13px] leading-relaxed text-muted-foreground";

export default function CreateContact({
  onBack,
  onSaved,
  contactLists = defaultContactLists,
}: {
  onBack: () => void;
  onSaved: (formData: {
    firstName: string;
    lastName: string;
    mobile: string;
    email: string;
    optIn: string;
    selectedLists: string[];
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
  const [optIn, setOptIn] = useState("Subscribed");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filteredLists = contactLists.filter(
    (l) => l.toLowerCase().includes(listQuery.toLowerCase()) && !selectedLists.includes(l)
  );

  const handleSave = async () => {
    if (!mobile.trim()) {
      setError("Mobile number is required");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onSaved({ firstName, lastName, mobile, email, optIn, selectedLists });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 pb-12 pt-7 lg:px-8">
      <nav className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
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
      <p className="mb-7 mt-1 text-[13px] text-muted-foreground">Add a single contact to your workspace.</p>

      <div className="kimi-card p-6">
        {error && (
          <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-[13px] font-medium text-rose-700">
            {error}
          </div>
        )}
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="cc-first">First Name</label>
              <input id="cc-first" className="kimi-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="cc-last">Last Name</label>
              <input id="cc-last" className="kimi-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="cc-mobile">
              Mobile Number <span className="text-rose-500">*</span>
            </label>
            <input
              id="cc-mobile"
              className="kimi-input"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="(555) 000-0000"
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="cc-email">Email — Optional</label>
            <input id="cc-email" className="kimi-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="cc-optin">Opt-In Status</label>
            <div className="relative">
              <select
                id="cc-optin"
                className="kimi-input appearance-none pr-8"
                value={optIn}
                onChange={(e) => setOptIn(e.target.value)}
              >
                <option>Subscribed</option>
                <option>Not Subscribed</option>
                <option>Unsubscribed</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
            <p className="mt-1.5 text-[12px] text-muted-foreground">
              Only mark Subscribed if this person expressly opted in to receive messages.
            </p>
          </div>
          <div>
            <label className={labelCls}>Lists — Optional</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setListOpen((v) => !v)}
                aria-expanded={listOpen}
                className="flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 py-2 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:border-primary/40"
              >
                {selectedLists.length === 0 && (
                  <span className="text-[13px] text-muted-foreground/80">Select lists…</span>
                )}
                {selectedLists.map((l) => (
                  <span
                    key={l}
                    className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[12px] font-medium text-primary"
                  >
                    {l}
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Remove ${l}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLists(selectedLists.filter((x) => x !== l));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.stopPropagation();
                          setSelectedLists(selectedLists.filter((x) => x !== l));
                        }
                      }}
                      className="cursor-pointer rounded hover:text-primary/70"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </span>
                ))}
                <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
              {listOpen && (
                <div className="absolute z-30 mt-1 w-full rounded-xl border border-border bg-card py-1.5 shadow-[0_8px_24px_rgba(16,24,40,0.12)] kimi-anim-zoom">
                  <div className="border-b border-border px-3 py-2">
                    <input
                      autoFocus
                      value={listQuery}
                      onChange={(e) => setListQuery(e.target.value)}
                      placeholder="Search lists…"
                      className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/70"
                    />
                  </div>
                  <div className="max-h-44 overflow-y-auto">
                    {filteredLists.length === 0 && (
                      <p className="px-3.5 py-2.5 text-[12px] text-muted-foreground">No matching lists</p>
                    )}
                    {filteredLists.map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => {
                          setSelectedLists([...selectedLists, l]);
                          setListQuery("");
                        }}
                        className="flex w-full items-center px-3.5 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-3">
        <button type="button" onClick={onBack} className="kimi-btn-secondary">
          Cancel
        </button>
        <button type="button" onClick={() => void handleSave()} disabled={saving} className="kimi-btn-primary min-w-[120px]">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {saving ? "Saving…" : "Create Contact"}
        </button>
      </div>
    </div>
  );
}
