"use client";
import { useEffect, useRef, useState } from "react";
import {
  FileUp, UploadCloud, CheckCircle2, Columns3, ListChecks,
  ChevronDown, Check, FileSpreadsheet, Users, X,
} from "lucide-react";
import { contactFieldOptions, contactLists, importColumns } from "../mock-data";

type Step = "upload" | "columns" | "optin" | "lists" | "review";

const STEPS: { id: Step; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "columns", label: "Assign Columns" },
  { id: "optin", label: "Opt-In Status" },
  { id: "lists", label: "Lists" },
  { id: "review", label: "Review" },
];

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className={`w-11 h-6 rounded-full transition-colors duration-200 relative shrink-0 ${on ? "bg-primary" : "bg-muted border border-border"}`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200 ${on ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}

function Header({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <>
      <div className="text-xs text-muted-foreground mb-2">Contacts / Import Contacts</div>
      <div className="flex items-center gap-2.5">
        <Icon className="w-5 h-5 text-foreground" />
        <h1 className="text-[22px] font-bold tracking-tight text-foreground">{title}</h1>
      </div>
      <p className="text-[13px] text-muted-foreground mt-1 mb-6 max-w-2xl leading-relaxed">{subtitle}</p>
    </>
  );
}

function Stepper({ step }: { step: Step }) {
  const activeIdx = STEPS.findIndex((s) => s.id === step);
  return (
    <div className="flex items-center gap-2 mb-7">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <span
            className={`flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-semibold transition-colors ${
              i < activeIdx
                ? "bg-emerald-100 text-emerald-700"
                : i === activeIdx
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {i < activeIdx ? <Check className="w-3 h-3" /> : i + 1}
          </span>
          <span className={`text-xs font-medium ${i === activeIdx ? "text-foreground" : "text-muted-foreground"}`}>
            {s.label}
          </span>
          {i < STEPS.length - 1 && <span className="w-6 h-px bg-border mx-1" />}
        </div>
      ))}
    </div>
  );
}

export default function ImportWizard({
  onCancel,
  onDone,
  onImportFile,
}: {
  onCancel: () => void;
  onDone: () => void;
  onImportFile?: (file: File) => Promise<void>;
}) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [headerRow, setHeaderRow] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const [mapping, setMapping] = useState<Record<string, string>>({
    "First Name": "First Name",
    "Last Name": "Last Name",
    Mobile: "None",
    "Opt-In Status": "Opt-In Status",
  });
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [optInChoice, setOptInChoice] = useState("");
  const [optInOpen, setOptInOpen] = useState(false);
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
        setOptInOpen(false);
        setListOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const next = () => {
    if (step === "upload") setStep("columns");
    else if (step === "columns") setStep("optin");
    else if (step === "optin") setStep("lists");
    else if (step === "lists") setStep("review");
    else {
      if (onImportFile && uploadedFile) {
        setImporting(true);
        void onImportFile(uploadedFile)
          .then(() => onDone())
          .catch(() => onDone())
          .finally(() => setImporting(false));
        return;
      }
      onDone();
    }
  };
  const prev = () => {
    if (step === "columns") setStep("upload");
    else if (step === "optin") setStep("columns");
    else if (step === "lists") setStep("optin");
    else if (step === "review") setStep("lists");
  };

  const nextLabel = step === "review" ? (importing ? "Importing…" : "Import Contacts") : "Next →";
  const nextDisabled =
    (step === "upload" && !file) ||
    (step === "optin" && !optInChoice) ||
    (step === "review" && !confirmed) ||
    importing;

  return (
    <div className="px-8 pt-6 pb-10 max-w-4xl flex flex-col min-h-screen" ref={dropdownRef}>
      <Stepper step={step} />

      <div className="flex-1">
        {step === "upload" && (
          <>
            <Header icon={FileUp} title="Import Contacts" subtitle="Import or update existing contacts in bulk." />
            {file ? (
              <div className="border-2 border-emerald-300 bg-emerald-50/60 rounded-xl p-10 text-center mb-8">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <div className="text-sm font-semibold text-emerald-700">File Uploaded</div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-2">
                  {file}
                  <button onClick={() => setFile(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <label className="block w-full border-2 border-dashed border-primary/40 bg-primary/[0.02] rounded-xl p-12 text-center hover:bg-primary/5 hover:border-primary/60 transition-colors mb-8 cursor-pointer">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(e) => {
                    const picked = e.target.files?.[0];
                    if (!picked) return;
                    setUploadedFile(picked);
                    setFile(picked.name);
                  }}
                />
                <UploadCloud className="w-8 h-8 text-primary mx-auto mb-2" />
                <div className="text-sm font-semibold text-primary">Click or Drag to Upload</div>
                <div className="text-xs text-muted-foreground mt-1.5">.csv files only · 100 MB or less · 100k contacts or less</div>
              </label>
            )}

            <div className="space-y-7">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="text-sm font-semibold text-foreground mb-1">File Contains a Header Row</div>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-md">
                    If the file you're uploading has a first row that contains column names, it makes it easier to map your data to each contact field.
                  </p>
                </div>
                <Toggle on={headerRow} onChange={setHeaderRow} />
              </div>
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="text-sm font-semibold text-foreground mb-1">Update Existing Contacts</div>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-md">
                    In the event that a contact already exists, enabling this will update that contact's existing data with the new data in your file.
                  </p>
                </div>
                <Toggle on={updateExisting} onChange={setUpdateExisting} />
              </div>
              {updateExisting && (
                <div className="flex items-start justify-between gap-6 pl-6 border-l-2 border-primary/20">
                  <div>
                    <div className="text-sm font-semibold text-foreground mb-1 flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-muted-foreground" /> Only Update Empty Fields
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed max-w-md">Enabling this will only update contact fields that are empty.</p>
                  </div>
                  <Toggle on={onlyEmpty} onChange={setOnlyEmpty} />
                </div>
              )}
            </div>
          </>
        )}

        {step === "columns" && (
          <>
            <Header icon={Columns3} title="Assign Columns" subtitle="Below are all of the columns found in your file. Select a contact field on the right for each column you want to import. If your file contains a header row, some may already be selected for you." />
            <div className="kc-card overflow-hidden">
              <div className="grid grid-cols-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/40 px-5 py-3">
                <span>Column Name</span><span>Sample Column Data</span><span>Contact Field</span>
              </div>
              {importColumns.map((col) => {
                const assigned = mapping[col.name];
                const matched = assigned && assigned !== "None";
                return (
                  <div key={col.name} className="grid grid-cols-3 items-center px-5 py-3.5 border-t border-border">
                    <span className="text-[13px] font-medium text-foreground">{col.name}</span>
                    <span className="text-[13px] text-muted-foreground">{col.sample}</span>
                    <div className="relative">
                      <button
                        onClick={() => setOpenDropdown(openDropdown === col.name ? null : col.name)}
                        className={`w-full flex items-center justify-between px-3 h-9 border rounded-lg text-[13px] transition-colors ${
                          matched ? "border-emerald-400 bg-emerald-50/60" : "border-border hover:border-muted-foreground/40"
                        }`}
                      >
                        <span className="flex items-center gap-2 text-foreground">
                          {assigned}
                          {matched && <Check className="w-4 h-4 text-emerald-500" />}
                        </span>
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      </button>
                      {openDropdown === col.name && (
                        <div className="kc-menu absolute z-20 mt-1 w-full max-h-56 overflow-y-auto py-1.5">
                          {contactFieldOptions.map((opt) => (
                            <button
                              key={opt}
                              onClick={() => { setMapping({ ...mapping, [col.name]: opt }); setOpenDropdown(null); }}
                              className={`w-full text-left px-3.5 py-2 text-[13px] transition-colors hover:bg-accent ${
                                opt === assigned ? "text-primary font-semibold" : "text-foreground"
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {step === "optin" && (
          <>
            <Header icon={CheckCircle2} title="Opt-In Status" subtitle="A contact's opt-in status determines whether or not they can receive campaigns, automated, and inbox messages from you. You can learn more about each opt-in status here." />
            <label className="block text-[13px] font-medium text-foreground mb-1.5">Opt-In Status</label>
            <div className="relative max-w-lg">
              <button
                onClick={() => setOptInOpen(!optInOpen)}
                className="w-full flex items-center justify-between px-3 h-10 border border-border rounded-lg text-[13px] text-foreground bg-card transition hover:border-muted-foreground/40"
              >
                <span className={optInChoice ? "text-foreground" : "text-muted-foreground"}>
                  {optInChoice || "Select a Status..."}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>
              {optInOpen && (
                <div className="kc-menu absolute z-20 mt-1 w-full py-1.5">
                  {["Select a Status...", "Not Subscribed", "Subscribed", "Unsubscribed", "Blocked", "Use the assigned opt-in status column"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => { setOptInChoice(opt === "Select a Status..." ? "" : opt); setOptInOpen(false); }}
                      className={`w-full text-left px-3.5 py-2 text-[13px] transition-colors ${
                        opt === optInChoice ? "bg-primary/10 text-primary font-semibold" : "text-foreground hover:bg-accent"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {step === "lists" && (
          <>
            <Header icon={ListChecks} title="Select Lists" subtitle="If you'd like to add these contacts to one or more lists, you can select them below." />
            <label className="block text-[13px] font-medium text-foreground mb-1.5">Contact Lists</label>
            <div className="max-w-lg relative">
              <button
                onClick={() => setListOpen(!listOpen)}
                className="w-full flex items-center justify-between px-3 h-10 border border-border rounded-lg text-[13px] bg-card transition hover:border-muted-foreground/40"
              >
                <span className={selectedLists.length ? "text-foreground truncate" : "text-muted-foreground"}>
                  {selectedLists.length ? selectedLists.join(", ") : "Search"}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
              {listOpen && (
                <div className="kc-menu absolute z-20 w-full mt-1 max-h-56 overflow-y-auto py-1.5">
                  {contactLists.map((l) => (
                    <button
                      key={l}
                      onClick={() =>
                        setSelectedLists(selectedLists.includes(l) ? selectedLists.filter((x) => x !== l) : [...selectedLists, l])
                      }
                      className="w-full text-left px-3.5 py-2 text-[13px] text-foreground hover:bg-accent transition-colors flex items-center gap-2"
                    >
                      {l}
                      {selectedLists.includes(l) && <Check className="w-4 h-4 text-primary ml-auto" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedLists.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3 max-w-lg">
                {selectedLists.map((l) => (
                  <span key={l} className="flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium pl-2.5 pr-1.5 py-1 rounded-md">
                    {l}
                    <button
                      onClick={() => setSelectedLists(selectedLists.filter((x) => x !== l))}
                      className="hover:bg-primary/15 rounded p-0.5 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        {step === "review" && (
          <>
            <Header icon={Users} title="Review Details" subtitle="Confirm your import details." />
            <div className="kc-card p-5 max-w-2xl">
              <div className="flex items-center justify-between bg-muted/40 rounded-lg px-4 py-3.5 mb-4">
                <span className="flex items-center gap-2.5 text-[13px] font-medium text-foreground">
                  <span className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </span>
                  Contacts to Import
                </span>
                <span className="text-lg font-bold tracking-tight text-foreground">70</span>
              </div>
              <dl className="divide-y divide-border text-[13px]">
                <div className="flex items-center justify-between py-3">
                  <dt className="text-muted-foreground">File Contains Header Row</dt>
                  <dd className="font-medium text-foreground">{headerRow ? "Yes" : "No"}</dd>
                </div>
                <div className="flex items-center justify-between py-3">
                  <dt className="text-muted-foreground">Update Existing Contacts</dt>
                  <dd className="font-medium text-foreground">
                    {updateExisting ? (onlyEmpty ? "Only Empty Fields" : "Yes") : "No"}
                  </dd>
                </div>
                <div className="flex items-center justify-between py-3">
                  <dt className="text-muted-foreground">Opt-In Status</dt>
                  <dd className="font-medium text-foreground">{optInChoice}</dd>
                </div>
                <div className="flex items-center justify-between py-3">
                  <dt className="text-muted-foreground">Lists to Add Contacts To</dt>
                  <dd className="font-medium text-foreground">{selectedLists.length || "0"}</dd>
                </div>
              </dl>
            </div>
            <label className="flex items-start gap-2.5 mt-5 max-w-2xl text-xs text-muted-foreground leading-relaxed cursor-pointer">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="kc-check mt-0.5" />
              <span>
                I confirm that the contacts in this file have consented to receive text messages from my brand in
                compliance with the Transovo <span className="text-primary font-medium">Terms of Use</span> and{" "}
                <span className="text-primary font-medium">Anti-Spam Policy</span>, recognizes the sender, and expect to
                receive said messages from them.
              </span>
            </label>
          </>
        )}
      </div>

      {/* Sticky footer actions */}
      <div className="flex items-center justify-between pt-6 mt-8 border-t border-border">
        {step === "upload" ? (
          <button onClick={onCancel} className="kc-btn-secondary px-8 h-10 text-[13px]">Cancel</button>
        ) : (
          <button onClick={prev} className="kc-btn-secondary px-8 h-10 text-[13px]">← Prev</button>
        )}
        <button onClick={next} disabled={nextDisabled} className="kc-btn-primary px-8 h-10 text-[13px]">
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
