"use client";
import { useEffect, useRef, useState } from "react";
import {
  FileUp, UploadCloud, CheckCircle2, Columns3, ListChecks,
  ChevronDown, Check, FileSpreadsheet, Users, X, ClipboardCheck, FileCheck2,
} from "lucide-react";
import { contactFieldOptions, contactLists as defaultContactLists, importColumns as defaultImportColumns, type ImportColumn } from "../mock-data";
import { parseImportCsvColumns, type KimiImportPayload } from "@/lib/contacts/kimi-contacts-adapter";

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
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-primary" : "border border-border bg-muted"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200 ${on ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}

function Header({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <>
      <div className="mb-2 text-xs text-muted-foreground">Contacts / <span className="text-foreground">Import Contacts</span></div>
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground">{title}</h1>
      </div>
      <p className="mb-6 mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">{subtitle}</p>
    </>
  );
}

function Stepper({ step }: { step: Step }) {
  const activeIdx = STEPS.findIndex((s) => s.id === step);
  return (
    <div className="mb-7 flex items-center gap-2">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
              i < activeIdx
                ? "bg-emerald-100 text-emerald-700"
                : i === activeIdx
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {i < activeIdx ? <Check className="h-3 w-3" /> : i + 1}
          </span>
          <span className={`text-xs font-medium ${i === activeIdx ? "text-foreground" : "text-muted-foreground"}`}>
            {s.label}
          </span>
          {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-border" />}
        </div>
      ))}
    </div>
  );
}

export default function ImportWizard({
  onCancel,
  onDone,
  onImportFile,
  contactLists = defaultContactLists,
}: {
  onCancel: () => void;
  onDone: () => void;
  onImportFile?: (payload: KimiImportPayload) => Promise<void>;
  contactLists?: string[];
}) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedColumns, setParsedColumns] = useState<ImportColumn[]>(defaultImportColumns);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
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
        setImportError("");
        void onImportFile({
          file: uploadedFile,
          mapping,
          optInChoice,
          selectedLists,
          headerRow,
        })
          .then(() => onDone())
          .catch((err) => {
            setImportError(err instanceof Error ? err.message : "Import failed");
          })
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

  const optInOptions = [
    "Subscribed",
    "Not Subscribed",
    "Use the assigned opt-in status column",
  ];

  const mappedCount = Object.values(mapping).filter((v) => v && v !== "None").length;

  return (
    <div className="flex min-h-screen max-w-4xl flex-col px-8 pb-10 pt-6" ref={dropdownRef}>
      <Stepper step={step} />

      <div className="flex-1">
        {step === "upload" && (
          <>
            <Header icon={FileUp} title="Import Contacts" subtitle="Import or update existing contacts in bulk." />
            {file ? (
              <div className="mb-8 rounded-xl border-2 border-emerald-300 bg-emerald-50/60 p-10 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
                <div className="text-sm font-semibold text-emerald-700">File Uploaded</div>
                <div className="mt-1 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  {file}
                  <button onClick={() => { setFile(null); setUploadedFile(null); }} className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-emerald-100 hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <label className="mb-8 block w-full cursor-pointer rounded-xl border-2 border-dashed border-primary/40 bg-primary/[0.02] p-12 text-center transition-colors hover:border-primary/60 hover:bg-primary/5">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(e) => {
                    const picked = e.target.files?.[0];
                    if (!picked) return;
                    setUploadedFile(picked);
                    setFile(picked.name);
                    setImportError("");
                    const reader = new FileReader();
                    reader.onload = () => {
                      const text = String(reader.result || "");
                      const { columns, mapping: guessed } = parseImportCsvColumns(text, headerRow);
                      if (columns.length) {
                        setParsedColumns(columns);
                        setMapping((prev) => ({ ...prev, ...guessed }));
                      }
                    };
                    reader.readAsText(picked);
                  }}
                />
                <UploadCloud className="mx-auto mb-2 h-8 w-8 text-primary" />
                <div className="text-sm font-semibold text-primary">Click or Drag to Upload</div>
                <div className="mt-1.5 text-xs text-muted-foreground">.csv files only · 100 MB or less · 100k contacts or less</div>
              </label>
            )}

            <div className="space-y-7">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="mb-1 text-sm font-semibold text-foreground">File Contains a Header Row</div>
                  <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
                    If the file you're uploading has a first row that contains column names, it makes it easier to map your data to each contact field.
                  </p>
                </div>
                <Toggle on={headerRow} onChange={setHeaderRow} />
              </div>
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="mb-1 text-sm font-semibold text-foreground">Update Existing Contacts</div>
                  <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
                    In the event that a contact already exists, enabling this will update that contact's existing data with the new data in your file.
                  </p>
                </div>
                <Toggle on={updateExisting} onChange={setUpdateExisting} />
              </div>
              {updateExisting && (
                <div className="flex items-start justify-between gap-6 border-l-2 border-primary/20 pl-6">
                  <div>
                    <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <FileSpreadsheet className="h-4 w-4 text-muted-foreground" /> Only Update Empty Fields
                    </div>
                    <p className="max-w-md text-xs leading-relaxed text-muted-foreground">Enabling this will only update contact fields that are empty.</p>
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
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="grid grid-cols-3 bg-muted/40 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Column Name</span><span>Sample Column Data</span><span>Contact Field</span>
              </div>
              {parsedColumns.map((col) => {
                const assigned = mapping[col.name];
                const matched = assigned && assigned !== "None";
                return (
                  <div key={col.name} className="grid grid-cols-3 items-center border-t border-border px-5 py-3.5">
                    <span className="text-[13px] font-medium text-foreground">{col.name}</span>
                    <span className="text-[13px] text-muted-foreground">{col.sample}</span>
                    <div className="relative">
                      <button
                        onClick={() => setOpenDropdown(openDropdown === col.name ? null : col.name)}
                        className={`flex h-9 w-full items-center justify-between rounded-lg border px-3 text-[13px] transition-colors ${
                          matched ? "border-emerald-400 bg-emerald-50/60 text-foreground" : "border-border text-muted-foreground hover:border-muted-foreground/40"
                        }`}
                      >
                        <span className={matched ? "font-medium" : ""}>{assigned || "None"}</span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${openDropdown === col.name ? "rotate-180" : ""}`} />
                      </button>
                      {openDropdown === col.name && (
                        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-card py-1.5 shadow-lg animate-in fade-in zoom-in-95 duration-100">
                          {contactFieldOptions.map((opt) => (
                            <button
                              key={opt}
                              onClick={() => {
                                setMapping((prev) => ({ ...prev, [col.name]: opt }));
                                setOpenDropdown(null);
                              }}
                              className={`flex w-full items-center justify-between px-3.5 py-2 text-left text-[13px] transition-colors hover:bg-muted ${assigned === opt ? "font-medium text-primary" : "text-foreground"}`}
                            >
                              {opt}
                              {assigned === opt && <Check className="h-3.5 w-3.5" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {mappedCount} of {parsedColumns.length} columns mapped.
            </p>
          </>
        )}

        {step === "optin" && (
          <>
            <Header icon={FileCheck2} title="Opt-In Status" subtitle="Choose the opt-in status that will be applied to the contacts in this import. This determines whether they can receive campaigns and messages from you." />
            <div className="max-w-xl">
              <div className="relative">
                <button
                  onClick={() => setOptInOpen(!optInOpen)}
                  className={`flex h-10 w-full items-center justify-between rounded-lg border px-3 text-[13px] transition-colors ${
                    optInChoice ? "border-border bg-card text-foreground" : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40"
                  }`}
                >
                  <span>{optInChoice || "Select an option…"}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${optInOpen ? "rotate-180" : ""}`} />
                </button>
                {optInOpen && (
                  <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card py-1.5 shadow-lg animate-in fade-in zoom-in-95 duration-100">
                    {optInOptions.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => { setOptInChoice(opt); setOptInOpen(false); }}
                        className={`flex w-full items-center justify-between px-3.5 py-2 text-left text-[13px] transition-colors hover:bg-muted ${optInChoice === opt ? "font-medium text-primary" : "text-foreground"}`}
                      >
                        {opt}
                        {optInChoice === opt && <Check className="h-3.5 w-3.5" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Only import contacts as Subscribed if you have collected proper consent to message them.
              </p>
            </div>
          </>
        )}

        {step === "lists" && (
          <>
            <Header icon={ListChecks} title="Lists" subtitle="Optionally add the imported contacts to one or more lists." />
            <div className="relative max-w-xl">
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
                <span className="px-1 py-1 text-[13px] text-muted-foreground">
                  {selectedLists.length ? "" : "Select lists…"}
                </span>
              </div>
              {listOpen && (
                <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-card py-1.5 shadow-lg animate-in fade-in zoom-in-95 duration-100">
                  {contactLists.filter((l) => !selectedLists.includes(l)).map((l) => (
                    <button
                      key={l}
                      onClick={() => { setSelectedLists([...selectedLists, l]); setListOpen(false); }}
                      className="w-full px-3.5 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-muted"
                    >
                      {l}
                    </button>
                  ))}
                  {contactLists.filter((l) => !selectedLists.includes(l)).length === 0 && (
                    <div className="px-3.5 py-2 text-[13px] text-muted-foreground">All lists selected.</div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {step === "review" && (
          <>
            <Header icon={ClipboardCheck} title="Review & Import" subtitle="Review your import settings below before starting the import." />
            <div className="max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="divide-y divide-border">
                <div className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-[13px] text-muted-foreground">File</span>
                  <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground" /> {file || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-[13px] text-muted-foreground">Columns mapped</span>
                  <span className="text-[13px] font-medium text-foreground">{mappedCount} of {parsedColumns.length}</span>
                </div>
                <div className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-[13px] text-muted-foreground">Opt-in status</span>
                  <span className="text-[13px] font-medium text-foreground">{optInChoice || "—"}</span>
                </div>
                <div className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-[13px] text-muted-foreground">Lists</span>
                  <span className="text-[13px] font-medium text-foreground">
                    {selectedLists.length ? selectedLists.join(", ") : "None"}
                  </span>
                </div>
                <div className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-[13px] text-muted-foreground">Header row</span>
                  <span className="text-[13px] font-medium text-foreground">{headerRow ? "Yes" : "No"}</span>
                </div>
                <div className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-[13px] text-muted-foreground">Update existing contacts</span>
                  <span className="text-[13px] font-medium text-foreground">{updateExisting ? "Yes" : "No"}</span>
                </div>
              </div>
            </div>

            <label className="mt-5 flex max-w-xl cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="kc-check mt-0.5" />
              <span>
                I confirm that these contacts have consented to receive text messages from my brand in compliance with the
                Transovo <span className="font-medium text-primary">Terms of Use</span> and <span className="font-medium text-primary">Anti-Spam Policy</span>.
              </span>
            </label>

            {importError && (
              <div className="mt-4 max-w-xl rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
                {importError}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer actions */}
      <div className="mt-10 flex items-center justify-between border-t border-border pt-5">
        <button
          onClick={onCancel}
          className="h-10 rounded-lg px-4 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Cancel
        </button>
        <div className="flex items-center gap-3">
          {step !== "upload" && (
            <button
              onClick={prev}
              className="h-10 rounded-lg border border-border bg-card px-6 text-[13px] font-semibold text-foreground shadow-sm transition-colors hover:bg-muted/60"
            >
              Back
            </button>
          )}
          <button
            onClick={next}
            disabled={nextDisabled}
            className="h-10 rounded-lg bg-primary px-6 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            {nextLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
