"use client";
import { useEffect, useRef, useState } from "react";
import {
  FileUp,
  UploadCloud,
  Columns3,
  ListChecks,
  ChevronDown,
  Check,
  FileSpreadsheet,
  Users,
  X,
  ClipboardCheck,
  ShieldCheck,
  Download,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  contactFieldOptions,
  contactLists as defaultContactLists,
  importColumns as defaultImportColumns,
  optInChoices,
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

const MAX_FILE_MB = 10;

const CSV_TEMPLATE = [
  "First Name,Last Name,Mobile,Email,Opt-In Status",
  "Henry,Rosas,5551111111,henry@example.com,Subscribed",
  "Maria,Lopez,5552223333,maria@example.com,Not Subscribed",
].join("\n");

function downloadCsvTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "contacts-import-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      aria-label={label}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
        on ? "bg-primary" : "border border-border bg-muted"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200 ${
          on ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function Stepper({ step }: { step: Step }) {
  const activeIdx = STEPS.findIndex((s) => s.id === step);
  return (
    <div className="mb-7 flex flex-wrap items-center gap-2" aria-label="Import progress">
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
            aria-current={i === activeIdx ? "step" : undefined}
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

function FieldDropdown({
  value,
  onChange,
  open,
  onOpen,
  onClose,
}: {
  value: string;
  onChange: (v: string) => void;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (open ? onClose() : onOpen())}
        aria-expanded={open}
        className="flex h-10 w-full items-center justify-between rounded-[10px] border border-border bg-card px-3 text-[13px] text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:border-primary/40"
      >
        <span className={value === "None" ? "text-muted-foreground" : ""}>{value}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-card py-1.5 shadow-[0_8px_24px_rgba(16,24,40,0.12)] kimi-anim-zoom">
          {contactFieldOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                onClose();
              }}
              className="flex w-full items-center justify-between px-3.5 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
            >
              <span className={opt === "None" ? "text-muted-foreground" : ""}>{opt}</span>
              {value === opt && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ImportWizard({
  onCancel,
  onDone,
  contactLists = defaultContactLists,
}: {
  onCancel: () => void;
  onDone: (result?: import("../mock-data").ImportResult) => void;
  contactLists?: string[];
}) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<string | null>(null);
  const [fileError, setFileError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [parsedColumns] = useState<ImportColumn[]>(defaultImportColumns);
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
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [listQuery, setListQuery] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
        setListOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const acceptFile = (f: File | undefined | null) => {
    if (!f) return;
    const isCsv = /\.csv$/i.test(f.name) || f.type === "text/csv";
    if (!isCsv) {
      setFileError(`"${f.name}" isn't a CSV file. Export your contacts as a .csv and try again.`);
      return;
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setFileError(`"${f.name}" is larger than ${MAX_FILE_MB} MB. Split the file into smaller batches and try again.`);
      return;
    }
    setFileError("");
    setFile(f.name);
  };

  const next = () => {
    if (step === "upload") setStep("columns");
    else if (step === "columns") setStep("optin");
    else if (step === "optin") setStep("lists");
    else if (step === "lists") setStep("review");
    else {
      setImporting(true);
      setImportError("");
      // Simulated async import; surfaces both success and failure states
      setTimeout(() => {
        setImporting(false);
        onDone();
      }, 1400);
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
    (step === "columns" && mapping["Mobile"] === "None") ||
    (step === "optin" && !optInChoice) ||
    (step === "review" && (!confirmed || importing));

  const filteredLists = contactLists.filter(
    (l) => l.toLowerCase().includes(listQuery.toLowerCase()) && !selectedLists.includes(l)
  );

  const headerIcon =
    step === "upload" ? FileUp : step === "columns" ? Columns3 : step === "optin" ? ShieldCheck : step === "lists" ? ListChecks : ClipboardCheck;
  const HeaderIcon = headerIcon;
  const headerTitle =
    step === "upload"
      ? "Import Contacts"
      : step === "columns"
        ? "Assign Columns"
        : step === "optin"
          ? "Opt-In Status"
          : step === "lists"
            ? "Add to Lists"
            : "Review Import";
  const headerSubtitle =
    step === "upload"
      ? "Upload a CSV file of your contacts. We'll walk you through mapping columns, confirming opt-in status, and choosing lists."
      : step === "columns"
        ? "Match each column in your file to a contact field. A mobile number is required for every imported contact."
        : step === "optin"
          ? "Tell us the opt-in status of the contacts in this file. Only import contacts you have permission to message."
          : step === "lists"
            ? "Optionally add the imported contacts to one or more lists."
            : "Confirm your import details before we add these contacts.";

  return (
    <div className="mx-auto max-w-4xl px-6 pb-16 pt-7 lg:px-8">
      <nav className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <button type="button" onClick={onCancel} className="transition-colors hover:text-foreground">
          Contacts
        </button>
        <span>/</span>
        <span className="font-medium text-foreground">Import Contacts</span>
      </nav>
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <HeaderIcon className="h-4 w-4" />
        </span>
        <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground">{headerTitle}</h1>
      </div>
      <p className="mb-6 mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">{headerSubtitle}</p>

      <Stepper step={step} />

      {/* STEP: UPLOAD */}
      {step === "upload" && (
        <div className="kimi-card p-6">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              acceptFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {!file ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                acceptFile(e.dataTransfer.files?.[0]);
              }}
              className={`flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
                dragging ? "border-primary bg-primary/5" : "border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50"
              }`}
            >
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UploadCloud className="h-6 w-6" />
              </span>
              <p className="text-[14px] font-semibold text-foreground">Drag and drop your CSV here</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                or <span className="font-medium text-primary">browse your files</span>
              </p>
              <p className="mt-3 text-[12px] text-muted-foreground/80">
                CSV files up to {MAX_FILE_MB} MB · UTF-8 encoding recommended
              </p>
            </button>
          ) : (
            <div className="flex items-center gap-4 rounded-xl border border-border bg-muted/30 px-5 py-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <FileSpreadsheet className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-foreground">{file}</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">4 columns detected · ready to map</p>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {fileError && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-[13px] font-medium text-rose-700 kimi-anim-fade"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1">{fileError}</span>
              <button
                type="button"
                onClick={() => setFileError("")}
                className="rounded p-0.5 text-rose-500 transition-colors hover:text-rose-700"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="mt-5 flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4">
            <div>
              <p className="text-[13px] font-semibold text-foreground">First row contains column headers</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">We'll skip the first row when importing.</p>
            </div>
            <Toggle on={headerRow} onChange={setHeaderRow} label="First row contains column headers" />
          </div>

          <div className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground">
            <Download className="h-3.5 w-3.5" />
            <span>
              Need a starting point?{" "}
              <button type="button" onClick={downloadCsvTemplate} className="font-medium text-primary hover:underline">
                Download our CSV template
              </button>
            </span>
          </div>
        </div>
      )}

      {/* STEP: COLUMNS */}
      {step === "columns" && (
        <div className="kimi-card overflow-hidden" ref={dropdownRef}>
          <div className="border-b border-border px-6 py-4">
            <p className="text-[13px] font-semibold text-foreground">Map your columns</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Mobile Number is required. Unmapped columns will be ignored.
            </p>
          </div>
          <div className="divide-y divide-border">
            {parsedColumns.map((col) => (
              <div key={col.name} className="grid grid-cols-1 items-center gap-2 px-6 py-4 sm:grid-cols-[1fr_auto_1fr] sm:gap-4">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-foreground">{col.name}</p>
                  <p className="mt-0.5 truncate text-[12px] text-muted-foreground">e.g. {col.sample}</p>
                </div>
                <span className="hidden text-muted-foreground sm:inline">→</span>
                <FieldDropdown
                  value={mapping[col.name] ?? "None"}
                  onChange={(v) => setMapping((m) => ({ ...m, [col.name]: v }))}
                  open={openDropdown === col.name}
                  onOpen={() => setOpenDropdown(col.name)}
                  onClose={() => setOpenDropdown(null)}
                />
              </div>
            ))}
          </div>
          {mapping["Mobile"] === "None" && (
            <div className="border-t border-amber-200 bg-amber-50 px-6 py-3 text-[12px] font-medium text-amber-800">
              Map a column to Mobile Number to continue. Every contact requires a mobile number.
            </div>
          )}
          <div className="space-y-4 border-t border-border px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[13px] font-semibold text-foreground">Update existing contacts</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  When a mobile number already exists, update that contact with values from this file.
                </p>
              </div>
              <Toggle on={updateExisting} onChange={setUpdateExisting} label="Update existing contacts" />
            </div>
            {updateExisting && (
              <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/40 px-4 py-3">
                <div>
                  <p className="text-[13px] font-semibold text-foreground">Only fill empty fields</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    Don't overwrite values that are already set on the contact.
                  </p>
                </div>
                <Toggle on={onlyEmpty} onChange={setOnlyEmpty} label="Only fill empty fields" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP: OPT-IN */}
      {step === "optin" && (
        <div className="kimi-card p-6">
          <div className="space-y-3" role="radiogroup" aria-label="Opt-in status for imported contacts">
            {optInChoices.map((choice) => (
              <button
                key={choice.value}
                type="button"
                role="radio"
                aria-checked={optInChoice === choice.value}
                onClick={() => setOptInChoice(choice.value)}
                className={`flex w-full items-start gap-3.5 rounded-xl border px-5 py-4 text-left transition-colors ${
                  optInChoice === choice.value
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border bg-card hover:border-primary/30"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    optInChoice === choice.value ? "border-primary" : "border-border"
                  }`}
                >
                  {optInChoice === choice.value && <span className="h-2 w-2 rounded-full bg-primary" />}
                </span>
                <span>
                  <span className="block text-[13px] font-semibold text-foreground">{choice.label}</span>
                  <span className="mt-0.5 block text-[12px] leading-relaxed text-muted-foreground">{choice.description}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-5 py-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Only import contacts you have a lawful basis to message. Marking contacts as Subscribed attests that each
              person expressly opted in to receive texts from your organization. This attestation is recorded with the
              import.
            </p>
          </div>
        </div>
      )}

      {/* STEP: LISTS */}
      {step === "lists" && (
        <div className="kimi-card p-6" ref={dropdownRef}>
          <label className="mb-1.5 block text-[13px] font-semibold text-foreground">Lists</label>
          <p className="mb-3 text-[12px] text-muted-foreground">
            Imported contacts will be added to these lists. This step is optional.
          </p>
          <div className="relative">
            <button
              type="button"
              onClick={() => setListOpen((v) => !v)}
              aria-expanded={listOpen}
              className="flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 py-2 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:border-primary/40"
            >
              {selectedLists.length === 0 && <span className="text-[13px] text-muted-foreground/80">Select lists…</span>}
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
                <div className="max-h-48 overflow-y-auto">
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
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <p className="mt-3 text-[12px] text-muted-foreground">
            {selectedLists.length === 0
              ? "Contacts won't be added to any list."
              : `Contacts will be added to ${selectedLists.length} ${selectedLists.length === 1 ? "list" : "lists"}.`}
          </p>
        </div>
      )}

      {/* STEP: REVIEW */}
      {step === "review" && (
        <div className="space-y-4">
          <div className="kimi-card divide-y divide-border">
            <div className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-foreground">{file}</p>
                  <p className="text-[12px] text-muted-foreground">{headerRow ? "First row skipped (headers)" : "All rows imported"}</p>
                </div>
              </div>
              <button type="button" onClick={() => setStep("upload")} className="shrink-0 text-[12px] font-medium text-primary hover:underline">
                Edit
              </button>
            </div>
            <div className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <Columns3 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">
                    {Object.values(mapping).filter((v) => v !== "None").length} columns mapped
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    {Object.entries(mapping)
                      .filter(([, v]) => v !== "None")
                      .map(([k, v]) => `${k} → ${v}`)
                      .join(" · ")}
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {updateExisting
                      ? onlyEmpty
                        ? "Existing contacts updated (empty fields only)"
                        : "Existing contacts updated"
                      : "Existing contacts left unchanged"}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setStep("columns")} className="shrink-0 text-[12px] font-medium text-primary hover:underline">
                Edit
              </button>
            </div>
            <div className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">
                    {optInChoices.find((c) => c.value === optInChoice)?.label}
                  </p>
                  <p className="text-[12px] text-muted-foreground">Opt-in status for imported contacts</p>
                </div>
              </div>
              <button type="button" onClick={() => setStep("optin")} className="shrink-0 text-[12px] font-medium text-primary hover:underline">
                Edit
              </button>
            </div>
            <div className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <ListChecks className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-foreground">
                    {selectedLists.length === 0 ? "No lists selected" : selectedLists.join(", ")}
                  </p>
                  <p className="text-[12px] text-muted-foreground">List assignments</p>
                </div>
              </div>
              <button type="button" onClick={() => setStep("lists")} className="shrink-0 text-[12px] font-medium text-primary hover:underline">
                Edit
              </button>
            </div>
          </div>

          <div className="kimi-card p-5">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border accent-[#4f46e5]"
              />
              <span className="text-[12px] leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">I confirm these contacts opted in.</span> I attest that
                the contacts in this file have expressly agreed to receive messages from my organization, and that this
                import complies with applicable messaging laws and carrier requirements.
              </span>
            </label>
          </div>

          {importError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-[13px] font-medium text-rose-700 kimi-anim-fade"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1">{importError}</span>
              <button
                type="button"
                onClick={() => setImportError("")}
                className="rounded p-0.5 text-rose-500 transition-colors hover:text-rose-700"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Footer actions */}
      <div className="mt-8 flex items-center justify-between gap-3">
        <div>
          {step !== "upload" ? (
            <button type="button" onClick={prev} className="kimi-btn-secondary">
              ← Back
            </button>
          ) : (
            <button type="button" onClick={onCancel} className="kimi-btn-secondary">
              Cancel
            </button>
          )}
        </div>
        <button type="button" onClick={next} disabled={nextDisabled} className="kimi-btn-primary min-w-[140px]">
          {importing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
