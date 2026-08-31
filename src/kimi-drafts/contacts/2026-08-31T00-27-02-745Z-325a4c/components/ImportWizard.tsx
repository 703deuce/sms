"use client";
import { useState } from "react";
import {
  FileUp, UploadCloud, CheckCircle2, Columns3, ListChecks,
  ChevronDown, Check, FileSpreadsheet, Users,
} from "lucide-react";
import { contactFieldOptions, contactLists, importColumns } from "../mock-data";

type Step = "upload" | "columns" | "optin" | "lists" | "review";

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`w-11 h-6 rounded-full transition-colors relative ${on ? "bg-primary" : "bg-muted"}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function Header({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <>
      <div className="text-xs text-muted-foreground mb-2">Contacts / Import Contacts</div>
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6 ml-12">{subtitle}</p>
    </>
  );
}

export default function ImportWizard({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<string | null>(null);
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

  const next = () => {
    if (step === "upload") setStep("columns");
    else if (step === "columns") setStep("optin");
    else if (step === "optin") setStep("lists");
    else if (step === "lists") setStep("review");
    else onDone();
  };
  const prev = () => {
    if (step === "columns") setStep("upload");
    else if (step === "optin") setStep("columns");
    else if (step === "lists") setStep("optin");
    else if (step === "review") setStep("lists");
  };

  const nextLabel = step === "review" ? "Import Contacts" : "Next →";
  const nextDisabled =
    (step === "upload" && !file) ||
    (step === "optin" && !optInChoice) ||
    (step === "review" && !confirmed);

  return (
    <div className="p-8 max-w-4xl">
      {step === "upload" && (
        <>
          <Header icon={FileUp} title="Import Contacts" subtitle="Import or update existing contacts in bulk." />
          {file ? (
            <div className="border-2 border-emerald-300 bg-emerald-50/50 rounded-xl p-10 text-center mb-8">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <div className="text-sm font-semibold text-emerald-700">File Uploaded</div>
              <div className="text-xs text-muted-foreground mt-1">{file}</div>
            </div>
          ) : (
            <button
              onClick={() => setFile("List Upload 1.csv")}
              className="w-full border-2 border-dashed border-primary/40 rounded-xl p-12 text-center hover:bg-primary/5 transition-colors mb-8"
            >
              <UploadCloud className="w-8 h-8 text-primary mx-auto mb-2" />
              <div className="text-sm font-semibold text-primary">Click or Drag to Upload</div>
              <div className="text-xs text-muted-foreground mt-1">.csv files only · 100 MB or less · 100k contacts or less</div>
            </button>
          )}

          <div className="space-y-6">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-sm font-semibold text-foreground mb-1">File Contains a Header Row</div>
                <p className="text-xs text-muted-foreground max-w-md">
                  If the file you're uploading has a first row that contains column names, it makes it easier to map your data to each contact field.
                </p>
              </div>
              <Toggle on={headerRow} onChange={setHeaderRow} />
            </div>
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-sm font-semibold text-foreground mb-1">Update Existing Contacts</div>
                <p className="text-xs text-muted-foreground max-w-md">
                  In the event that a contact already exists, enabling this will update that contact's existing data with the new data in your file.
                </p>
              </div>
              <Toggle on={updateExisting} onChange={setUpdateExisting} />
            </div>
            {updateExisting && (
              <div className="flex items-start justify-between gap-6 pl-6">
                <div>
                  <div className="text-sm font-semibold text-foreground mb-1 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-muted-foreground" /> Only Update Empty Fields
                  </div>
                  <p className="text-xs text-muted-foreground max-w-md">Enabling this will only update contact fields that are empty.</p>
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
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="grid grid-cols-3 text-xs font-semibold text-muted-foreground bg-muted/50 px-5 py-3">
              <span>COLUMN NAME</span><span>SAMPLE COLUMN DATA</span><span>CONTACT FIELD</span>
            </div>
            {importColumns.map((col) => {
              const assigned = mapping[col.name];
              const matched = assigned && assigned !== "None";
              return (
                <div key={col.name} className="grid grid-cols-3 items-center px-5 py-4 border-t border-border">
                  <span className="text-sm font-medium text-foreground">{col.name}</span>
                  <span className="text-sm text-muted-foreground">{col.sample}</span>
                  <div className="relative">
                    <button
                      onClick={() => setOpenDropdown(openDropdown === col.name ? null : col.name)}
                      className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm ${
                        matched ? "border-emerald-400 bg-emerald-50/50" : "border-border"
                      }`}
                    >
                      <span className="flex items-center gap-2 text-foreground">
                        {assigned}
                        {matched && <Check className="w-4 h-4 text-emerald-500" />}
                      </span>
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </button>
                    {openDropdown === col.name && (
                      <div className="absolute z-20 mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-56 overflow-y-auto py-1">
                        {contactFieldOptions.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => { setMapping({ ...mapping, [col.name]: opt }); setOpenDropdown(null); }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-accent ${opt === assigned ? "text-primary font-semibold" : "text-foreground"}`}
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
          <label className="block text-sm font-medium text-foreground mb-1.5">Opt-In Status</label>
          <div className="relative max-w-lg">
            <button
              onClick={() => setOptInOpen(!optInOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 border border-border rounded-lg text-sm text-foreground"
            >
              {optInChoice || "Select a Status..."}
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>
            {optInOpen && (
              <div className="absolute z-20 mt-1 w-full bg-card border border-border rounded-lg shadow-lg py-1">
                {["Select a Status...", "Not Subscribed", "Subscribed", "Unsubscribed", "Blocked", "Use the assigned opt-in status column"].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => { setOptInChoice(opt === "Select a Status..." ? "" : opt); setOptInOpen(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-primary hover:text-primary-foreground"
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
          <label className="block text-sm font-medium text-foreground mb-1.5">Contact Lists</label>
          <div className="max-w-lg">
            <button
              onClick={() => setListOpen(!listOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 border border-border rounded-lg text-sm"
            >
              <span className={selectedLists.length ? "text-foreground" : "text-muted-foreground"}>
                {selectedLists.length ? selectedLists.join(", ") : "Search"}
              </span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>
            {listOpen && (
              <div className="mt-1 border border-border rounded-lg bg-card shadow-lg max-h-56 overflow-y-auto py-1">
                {contactLists.map((l) => (
                  <button
                    key={l}
                    onClick={() =>
                      setSelectedLists(selectedLists.includes(l) ? selectedLists.filter((x) => x !== l) : [...selectedLists, l])
                    }
                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent flex items-center gap-2"
                  >
                    <span className="text-muted-foreground">☰</span> {l}
                    {selectedLists.includes(l) && <Check className="w-4 h-4 text-primary ml-auto" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {step === "review" && (
        <>
          <Header icon={FileUp} title="Review Details" subtitle="Confirm your import details." />
          <div className="bg-card border border-border rounded-xl p-5 mb-6 flex items-center justify-between max-w-2xl">
            <span className="flex items-center gap-2 text-sm text-foreground">
              <Users className="w-4 h-4 text-primary" /> Contacts to Import
            </span>
            <span className="text-lg font-bold text-foreground">70</span>
          </div>
          <div className="space-y-3 max-w-2xl mb-6 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">File Contains Header Row</span><span className="text-foreground font-medium">{headerRow ? "Yes" : "No"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Update Existing Contacts</span><span className="text-foreground font-medium">{updateExisting ? (onlyEmpty ? "Only Empty Fields" : "Yes") : "No"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Lists to Add Contacts To</span><span className="text-foreground font-medium">{selectedLists.length}</span></div>
          </div>
          <label className="flex items-start gap-2 max-w-2xl text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 rounded" />
            <span>
              I confirm that the contacts in this file have consented to receive text messages from my brand in compliance
              with the Transovo <span className="text-primary">Terms of Use</span> and <span className="text-primary">Anti-Spam Policy</span>,
              recognizes the sender, and expect to receive said messages from them.
            </span>
          </label>
        </>
      )}

      <div className="flex justify-between items-center mt-10 pt-4">
        {step === "upload" ? (
          <button onClick={onCancel} className="px-8 py-2.5 rounded-lg border border-border text-sm font-semibold text-foreground hover:bg-accent">
            Cancel
          </button>
        ) : (
          <button onClick={prev} className="px-8 py-2.5 rounded-lg border border-border text-sm font-semibold text-foreground hover:bg-accent">
            ← Prev
          </button>
        )}
        <button
          onClick={next}
          disabled={nextDisabled}
          className="px-8 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
