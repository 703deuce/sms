"use client";

import { useEffect, useRef, useState } from "react";
import {
  FileUp,
  UploadCloud,
  CheckCircle2,
  Columns3,
  ListChecks,
  ChevronDown,
  Check,
  FileSpreadsheet,
  Users,
  X,
  ClipboardCheck,
  FileCheck2,
  Loader2,
} from "lucide-react";
import {
  contactFieldOptions,
  contactLists as defaultContactLists,
  importColumns as defaultImportColumns,
  type ImportColumn,
} from "../mock-data";

type Step = "upload" | "columns" | "optin" | "lists" | "review";

const STEPS: { id: Step; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "columns", label: "Assign Columns" },
  { id: "optin", label: "Opt-In Status" },
  { id: "lists", label: "Lists" },
  { id: "review", label: "Review" },
];

const inputCls =
  "h-10 w-full rounded-[10px] border border-border bg-card px-3 text-[13px] text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition-colors placeholder:text-muted-foreground/80 focus:border-primary focus:ring-2 focus:ring-ring/30";
const labelCls = "mb-1.5 block text-[13px] font-semibold tracking-tight text-foreground/90";
const checkCls = "kc-check h-4 w-4 rounded border-border";

export interface KimiImportPayload {
  file: File | null;
  mapping: Record<string, string>;
  optInChoice: string;
  selectedLists: string[];
  headerRow: boolean;
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      aria-label={label}
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
      <div className="mb-2 text-xs text-muted-foreground">
        Contacts / <span className="text-foreground">Import Contacts</span>
      </div>
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
    <ol className="mb-7 flex flex-wrap items-center gap-2" aria-label="Import progress">
      {STEPS.map((s, i) => (
        <li key={s.id} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
              i < activeIdx
                ? "bg-emerald-100 text-emerald-700"
                : i === activeIdx
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
            }`}
            aria-current={i === activeIdx ? "step" : undefined}
          >
            {i < activeIdx ? <Check className="h-3 w-3" /> : i + 1}
          </span>
          <span className={`text-xs font-medium ${i === activeIdx ? "text-foreground" : "text-muted-foreground"}`}>
            {s.label}
          </span>
          {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-border" aria-hidden="true" />}
        </li>
      ))}
    </ol>
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
  const [parsedColumns] = useState<ImportColumn[]>(defaultImportColumns);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [headerRow, setHeaderRow] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const [mapping, setMapping] = useState<Record<string, string>>({
    "First Name": "First Name",
    "Last Name": "Last Name",
    Mobile: "Mobile Number",
    "Opt-In Status": "Opt-In Status",
  });
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [optInChoice, setOptInChoice] = useState("");
  const [optInOpen, setOptInOpen] = useState(false);
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const acceptFile = (f: File | null | undefined) => {
    if (!f) return;
    setUploadedFile(f);
    setFile(f.name);
  };

  const next = () => {
    if (step === "upload") setStep("columns");
    else if (step === "columns") setStep("optin");
    else if (step === "optin") setStep("lists");
    else if (step === "lists") setStep("review");
    else {
      if (onImportFile) {
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
    (step === "review" && (importing || !confirmed)) ||
    (step === "columns" && !Object.values(mapping).includes("Mobile Number"));

  const stepMeta: Record<Step, { icon: any; title: string; subtitle: string }> = {
    upload: {
      icon: FileUp,
      title: "Import Contacts",
      subtitle: "Upload a CSV file containing the contacts you want to add. We'll walk you through mapping columns, opt-in status, and lists.",
    },
    columns: {
      icon: Columns3,
      title: "Assign Columns",
      subtitle: "Match each column in your file to a contact field. A mobile number column is required.",
    },
    optin: {
      icon: ClipboardCheck,
      title: "Opt-In Status",
      subtitle: "Choose how opt-in status should be assigned to the imported contacts.",
    },
    lists: {
      icon: ListChecks,
      title: "Add to Lists",
      subtitle: "Optionally add every imported contact to one or more lists.",
    },
    review: {
      icon: FileCheck2,
      title: "Review & Import",
      subtitle: "Confirm your import settings before we add the contacts to your workspace.",
    },
  };

  const meta = stepMeta[step];

  return (
    <div className="mx-auto max-w-3xl px-6 pb-16 pt-7 lg:px-8">
      <Header icon={meta.icon} title={meta.title} subtitle={meta.subtitle} />
      <Stepper step={step} />

      {importError && (
        <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-[13px] font-medium text-rose-700">
          <X className="h-4 w-4 shrink-0" />
          {importError}
        </div>
      )}

      {/* STEP: upload */}
      {step === "upload" && (
        <div>
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              acceptFile(e.dataTransfer.files?.[0]);
            }}
            className={`flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
            }`}
          >
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UploadCloud className="h-6 w-6" />
            </span>
            {file ? (
              <>
                <span className="mb-1.5 inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-[13px] font-medium text-foreground">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  {file}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setUploadedFile(null);
                    }}
                    className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Remove file"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
                <p className="text-[12px] text-muted-foreground">Click or drop another file to replace it.</p>
              </>
            ) : (
              <>
                <p className="text-[14px] font-semibold text-foreground">Drag and drop your CSV file here</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  or <span className="font-medium text-primary">browse your files</span> — .csv up to 10&nbsp;MB
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => acceptFile(e.target.files?.[0])}
            />
          </div>

          <div className="mt-5 space-y-3 rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[13px] font-semibold text-foreground">First row contains headers</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">Skip the header row when importing.</p>
              </div>
              <Toggle on={headerRow} onChange={setHeaderRow} label="First row contains headers" />
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[13px] font-semibold text-foreground">Update existing contacts</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Match on mobile number and update fields instead of skipping.
                </p>
              </div>
              <Toggle on={updateExisting} onChange={setUpdateExisting} label="Update existing contacts" />
            </div>
            {updateExisting && (
              <>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-semibold text-foreground">Only update empty fields</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      Never overwrite data that already exists on a contact.
                    </p>
                  </div>
                  <Toggle on={onlyEmpty} onChange={setOnlyEmpty} label="Only update empty fields" />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* STEP: columns */}
      {step === "columns" && (
        <div className="rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)]" ref={dropdownRef}>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-border bg-muted/40 px-5 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Column in file</span>
            <span />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Contact field</span>
          </div>
          <div className="divide-y divide-border">
            {parsedColumns.map((col) => (
              <div key={col.name} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-foreground">{col.name}</p>
                  <p className="truncate text-[12px] text-muted-foreground">e.g. {col.sample}</p>
                </div>
                <span className="text-muted-foreground">→</span>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(openDropdown === col.name ? null : col.name)}
                    className="flex h-9 w-full items-center justify-between rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
                    aria-haspopup="listbox"
                    aria-expanded={openDropdown === col.name}
                  >
                    {mapping[col.name] || "None"}
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openDropdown === col.name ? "rotate-180" : ""}`} />
                  </button>
                  {openDropdown === col.name && (
                    <div className="kc-scroll absolute z-30 mt-1.5 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-card py-1.5 shadow-[0_8px_24px_rgba(16,24,40,0.12)] animate-in fade-in zoom-in-95" role="listbox">
                      {contactFieldOptions.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          role="option"
                          aria-selected={mapping[col.name] === opt}
                          onClick={() => {
                            setMapping({ ...mapping, [col.name]: opt });
                            setOpenDropdown(null);
                          }}
                          className="flex w-full items-center justify-between px-3.5 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
                        >
                          {opt}
                          {mapping[col.name] === opt && <Check className="h-3.5 w-3.5 text-primary" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {!Object.values(mapping).includes("Mobile Number") && (
            <p className="border-t border-border bg-amber-50/70 px-5 py-2.5 text-[12px] font-medium text-amber-700">
              Map one column to “Mobile Number” — it&rsquo;s required to import contacts.
            </p>
          )}
        </div>
      )}

      {/* STEP: optin */}
      {step === "optin" && (
        <div className="max-w-xl" ref={dropdownRef}>
          <label className={labelCls}>
            Assign opt-in status <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setOptInOpen((v) => !v)}
              className={`${inputCls} flex items-center justify-between font-medium`}
              aria-haspopup="listbox"
              aria-expanded={optInOpen}
            >
              {optInChoice || "Choose an option"}
              <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${optInOpen ? "rotate-180" : ""}`} />
            </button>
            {optInOpen && (
              <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-card py-1.5 shadow-[0_8px_24px_rgba(16,24,40,0.12)] animate-in fade-in zoom-in-95" role="listbox">
                {[
                  { v: "Subscribed", d: "These contacts have agreed to receive messages from you." },
                  { v: "Not Subscribed", d: "Import without messaging permission. No messages will be sent." },
                  { v: "From File Column", d: "Read each contact's status from the mapped Opt-In Status column." },
                ].map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    role="option"
                    aria-selected={optInChoice === o.v}
                    onClick={() => {
                      setOptInChoice(o.v);
                      setOptInOpen(false);
                    }}
                    className="flex w-full flex-col gap-0.5 px-3.5 py-2.5 text-left transition-colors hover:bg-muted"
                  >
                    <span className="flex items-center justify-between text-[13px] font-semibold text-foreground">
                      {o.v}
                      {optInChoice === o.v && <Check className="h-3.5 w-3.5 text-primary" />}
                    </span>
                    <span className="text-[12px] text-muted-foreground">{o.d}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4 text-[12px] leading-relaxed text-muted-foreground">
            <p className="mb-1 font-semibold text-foreground">A note on consent</p>
            Only mark contacts as Subscribed if you have evidence they agreed to receive messages. Contacts without
            opt-in are still imported — they simply won&rsquo;t be sent messages until they subscribe.
          </div>
        </div>
      )}

      {/* STEP: lists */}
      {step === "lists" && (
        <div className="max-w-xl" ref={dropdownRef}>
          <label className={labelCls}>Add imported contacts to lists (optional)</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setListOpen((v) => !v)}
              className="flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-[10px] border border-border bg-card px-2.5 py-1.5 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:bg-muted/40"
            >
              {selectedLists.length === 0 && <span className="px-1 text-[13px] text-muted-foreground/80">Choose lists</span>}
              {selectedLists.map((l) => (
                <span key={l} className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[12px] font-medium text-primary">
                  {l}
                  <span
                    role="button"
                    tabIndex={0}
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
                    className="cursor-pointer rounded p-0.5 hover:bg-primary/15"
                    aria-label={`Remove ${l}`}
                  >
                    <X className="h-3 w-3" />
                  </span>
                </span>
              ))}
              <ChevronDown className={`ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform ${listOpen ? "rotate-180" : ""}`} />
            </button>
            {listOpen && (
              <div className="kc-scroll absolute z-30 mt-1.5 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-card py-1.5 shadow-[0_8px_24px_rgba(16,24,40,0.12)] animate-in fade-in zoom-in-95">
                {contactLists
                  .filter((l) => !selectedLists.includes(l))
                  .map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => {
                        setSelectedLists([...selectedLists, l]);
                        setListOpen(false);
                      }}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      {l}
                    </button>
                  ))}
              </div>
            )}
          </div>
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-4">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Lists help you segment contacts — for example by location or team. You can always change list membership
              later from the Contacts page.
            </p>
          </div>
        </div>
      )}

      {/* STEP: review */}
      {step === "review" && (
        <div className="max-w-xl">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="divide-y divide-border">
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-[13px] text-muted-foreground">File</span>
                <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  {file ?? "contacts.csv"}
                </span>
              </div>
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-[13px] text-muted-foreground">Columns mapped</span>
                <span className="text-[13px] font-medium text-foreground">
                  {Object.values(mapping).filter((v) => v && v !== "None").length} of {parsedColumns.length}
                </span>
              </div>
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-[13px] text-muted-foreground">Opt-in status</span>
                <span className="text-[13px] font-medium text-foreground">{optInChoice}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-[13px] text-muted-foreground">Lists</span>
                <span className="text-[13px] font-medium text-foreground">
                  {selectedLists.length > 0 ? selectedLists.join(", ") : "None"}
                </span>
              </div>
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-[13px] text-muted-foreground">Header row</span>
                <span className="text-[13px] font-medium text-foreground">{headerRow ? "Skipped" : "Imported as a contact"}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-[13px] text-muted-foreground">Existing contacts</span>
                <span className="text-[13px] font-medium text-foreground">
                  {updateExisting ? (onlyEmpty ? "Update empty fields only" : "Updated") : "Skipped"}
                </span>
              </div>
            </div>
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <input
              type="checkbox"
              className={`${checkCls} mt-0.5`}
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span className="text-[12px] leading-relaxed text-muted-foreground">
              I confirm these contacts were collected in compliance with applicable messaging laws, and that any contact
              marked Subscribed has agreed to receive messages from our business.
            </span>
          </label>

          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p className="text-[12px] leading-relaxed text-emerald-800">
              Imports run in the background. You&rsquo;ll see a summary of created, updated, and skipped contacts when it
              finishes.
            </p>
          </div>
        </div>
      )}

      {/* Footer nav */}
      <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
        <div>
          {step !== "upload" ? (
            <button
              type="button"
              onClick={prev}
              className="h-10 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
            >
              ← Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onCancel}
              className="h-10 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Cancel
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={next}
          disabled={nextDisabled}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-5 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {importing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
