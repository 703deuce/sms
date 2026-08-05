"use client";

import { useRef, useState } from "react";
import type {
  AppointmentReceptionistWizardState,
  KnowledgeItemStatus,
  KnowledgeSource,
} from "@/lib/solutions/appointment-receptionist/types";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  FileText,
  Globe,
  Link2,
  Pencil,
  X,
} from "lucide-react";
import { InfoCallout, SelectableCard, SidePanel, StatusPill } from "../ui";

type KnowledgeItem = AppointmentReceptionistWizardState["knowledgeItems"][number];

function guessBusinessNameFromUrl(url: string): string {
  let host = url;
  try {
    host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(
      /^www\./,
      "",
    );
  } catch {
    // keep raw
  }
  return host
    .split(".")[0]
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeWebsiteUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

function itemsForScanResult(input: {
  businessName: string;
  url: string;
  sourceStatus?: string | null;
  chunkCount?: number | null;
  preview?: string | null;
  errorMessage?: string | null;
}): KnowledgeItem[] {
  const ok =
    input.sourceStatus === "indexed" ||
    input.sourceStatus === "ready" ||
    (input.chunkCount != null && input.chunkCount > 0);
  const preview = (input.preview || "").trim();
  return [
    {
      id: "business",
      label: "Business details",
      summary: input.businessName
        ? `${input.businessName} · ${input.url}`
        : input.url,
      status: ok ? "complete" : "warning",
      statusLabel: ok ? "Imported from website" : "Partial import",
    },
    {
      id: "hours",
      label: "Hours",
      summary: preview
        ? preview.slice(0, 160)
        : "Review hours on your site or edit this item",
      status: ok ? "complete" : "warning",
      statusLabel: ok ? "From website" : "Needs review",
    },
    {
      id: "services",
      label: "Services",
      summary: ok
        ? "Services and offerings from your website"
        : input.errorMessage || "Scan incomplete",
      status: ok ? "complete" : "warning",
      statusLabel: ok ? "From website" : "Needs review",
    },
    {
      id: "pricing",
      label: "Pricing",
      summary: "Add pricing so the AI can answer cost questions",
      status: "warning",
      statusLabel: "Optional",
    },
    {
      id: "policies",
      label: "Policies",
      summary: "Cancellation, deposits, and house rules",
      status: "optional",
      statusLabel: "Optional",
    },
  ];
}

function upsertItem(
  items: KnowledgeItem[],
  id: string,
  patch: Partial<KnowledgeItem>,
): KnowledgeItem[] {
  const exists = items.some((i) => i.id === id);
  if (!exists) {
    return [
      ...items,
      {
        id,
        label: patch.label || id,
        summary: patch.summary || "",
        status: (patch.status as KnowledgeItemStatus) || "complete",
        statusLabel: patch.statusLabel || "Saved",
      },
    ];
  }
  return items.map((i) =>
    i.id === id
      ? {
          ...i,
          ...patch,
          status: (patch.status as KnowledgeItemStatus) || i.status,
        }
      : i,
  );
}

export function InformationStep({
  state,
  patch,
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ label: "", summary: "" });
  const [guided, setGuided] = useState({
    businessName: state.businessName || "",
    address: "",
    hours: "",
    services: "",
    pricing: "",
    policies: "",
  });
  const [uploadNote, setUploadNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function importWebsiteKnowledge() {
    const url = normalizeWebsiteUrl(state.websiteUrl);
    if (!url) return;
    setScanning(true);
    setScanError("");
    try {
      const businessName =
        state.businessName?.trim() || guessBusinessNameFromUrl(url);
      const res = await fetch("/api/voice/knowledge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "scan_website",
          url,
          name: `${businessName || "Business"} website`,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Website scan failed");
      }
      const source = json?.data?.source || json?.data;
      patch({
        businessName,
        websiteUrl: url,
        knowledgeItems: itemsForScanResult({
          businessName,
          url,
          sourceStatus: source?.status,
          chunkCount: source?.chunkCount,
          preview: source?.extractedPreview || source?.contentText,
          errorMessage: source?.errorMessage,
        }),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Website scan failed";
      setScanError(message);
      const businessName =
        state.businessName?.trim() || guessBusinessNameFromUrl(url);
      patch({
        businessName,
        websiteUrl: url,
        knowledgeItems: itemsForScanResult({
          businessName,
          url,
          sourceStatus: "failed",
          errorMessage: message,
        }),
      });
    } finally {
      setScanning(false);
    }
  }

  function saveGuidedProfile() {
    let items = [...state.knowledgeItems];
    const biz = guided.businessName.trim() || state.businessName;
    if (biz) {
      items = upsertItem(items, "business", {
        label: "Business details",
        summary: [biz, guided.address.trim()].filter(Boolean).join(" · "),
        status: "complete",
        statusLabel: "Configured",
      });
    }
    if (guided.hours.trim()) {
      items = upsertItem(items, "hours", {
        label: "Hours",
        summary: guided.hours.trim(),
        status: "complete",
        statusLabel: "Configured",
      });
    }
    if (guided.services.trim()) {
      items = upsertItem(items, "services", {
        label: "Services",
        summary: guided.services.trim(),
        status: "complete",
        statusLabel: "Configured",
      });
    }
    if (guided.pricing.trim()) {
      items = upsertItem(items, "pricing", {
        label: "Pricing",
        summary: guided.pricing.trim(),
        status: "complete",
        statusLabel: "Configured",
      });
    }
    if (guided.policies.trim()) {
      items = upsertItem(items, "policies", {
        label: "Policies",
        summary: guided.policies.trim(),
        status: "complete",
        statusLabel: "Configured",
      });
    }
    patch({
      businessName: biz || state.businessName,
      knowledgeItems: items,
      knowledgeSource: "guided_profile",
    });
  }

  async function onUploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploadNote("");
    let items = [...state.knowledgeItems];
    for (const file of Array.from(files)) {
      const lower = file.name.toLowerCase();
      const isText =
        file.type.startsWith("text/") ||
        /\.(txt|md|csv|json)$/i.test(lower);
      if (!isText) {
        items = upsertItem(items, `file-${file.name}`, {
          label: file.name,
          summary: `Uploaded file (${file.type || "binary"}). Paste key facts into an editable knowledge item if the AI must answer from this PDF/DOCX.`,
          status: "warning",
          statusLabel: "Name saved — add text facts",
        });
        continue;
      }
      const text = (await file.text()).slice(0, 20_000);
      items = upsertItem(items, `file-${file.name}`, {
        label: file.name,
        summary: text.slice(0, 2000),
        status: "complete",
        statusLabel: "Uploaded",
      });
    }
    patch({ knowledgeItems: items, knowledgeSource: "upload_docs" });
    setUploadNote(`${files.length} file(s) added to knowledge.`);
    if (fileRef.current) fileRef.current.value = "";
  }

  function openEdit(item: KnowledgeItem) {
    setEditingId(item.id);
    setEditDraft({ label: item.label, summary: item.summary });
  }

  function saveEdit() {
    if (!editingId) return;
    patch({
      knowledgeItems: state.knowledgeItems.map((i) =>
        i.id === editingId
          ? {
              ...i,
              label: editDraft.label.trim() || i.label,
              summary: editDraft.summary.trim(),
              status: editDraft.summary.trim() ? "complete" : "missing",
              statusLabel: editDraft.summary.trim()
                ? "Configured"
                : "Not configured",
            }
          : i,
      ),
    });
    setEditingId(null);
  }

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 space-y-8">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            What should your agent know?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add business information so the AI can answer with confidence. Facts
            here are written into the agent knowledge on save/activate.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SelectableCard
              selected={state.knowledgeSource === "website"}
              onClick={() => patch({ knowledgeSource: "website" as KnowledgeSource })}
              title="Import from your website"
              description="Scan your site for services, hours, FAQs, and more."
              icon={<Globe className="h-4 w-4" />}
            />
            <SelectableCard
              selected={state.knowledgeSource === "guided_profile"}
              onClick={() => patch({ knowledgeSource: "guided_profile" })}
              title="Complete guided business profile"
              description="Enter hours, services, pricing, and policies."
              icon={<FileText className="h-4 w-4" />}
            />
            <SelectableCard
              selected={state.knowledgeSource === "upload_docs"}
              onClick={() => patch({ knowledgeSource: "upload_docs" })}
              title="Upload documents"
              description="TXT, MD, CSV (PDF/DOCX: add text facts after upload)."
              icon={<CloudUpload className="h-4 w-4" />}
            />
            <SelectableCard
              selected={state.knowledgeSource === "connect_data"}
              onClick={() => patch({ knowledgeSource: "connect_data" })}
              title="Connect existing data"
              description="Use website scan or guided profile for now — CRM sync comes next."
              icon={<Link2 className="h-4 w-4" />}
            />
          </div>

          {state.knowledgeSource === "website" ? (
            <div className="mt-3 rounded-xl border border-primary/30 bg-card p-4">
              <Label htmlFor="website-url" className="text-xs">
                Business website URL
              </Label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  id="website-url"
                  value={state.websiteUrl}
                  onChange={(e) => patch({ websiteUrl: e.target.value })}
                  placeholder="https://www.example.com"
                  disabled={scanning}
                />
                <button
                  type="button"
                  onClick={() => void importWebsiteKnowledge()}
                  disabled={scanning || !state.websiteUrl.trim()}
                  className="shrink-0 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-60"
                >
                  {scanning ? "Scanning…" : "Scan"}
                </button>
              </div>
              {scanError ? (
                <p className="mt-2 text-xs text-warning">{scanError}</p>
              ) : null}
            </div>
          ) : null}

          {state.knowledgeSource === "guided_profile" ? (
            <div className="mt-3 space-y-3 rounded-xl border border-primary/30 bg-card p-4">
              <div>
                <Label className="text-xs">Business name</Label>
                <Input
                  className="mt-1"
                  value={guided.businessName}
                  onChange={(e) =>
                    setGuided((g) => ({ ...g, businessName: e.target.value }))
                  }
                  placeholder="Acme Dental"
                />
              </div>
              <div>
                <Label className="text-xs">Address / locations</Label>
                <Input
                  className="mt-1"
                  value={guided.address}
                  onChange={(e) =>
                    setGuided((g) => ({ ...g, address: e.target.value }))
                  }
                  placeholder="123 Main St, Austin TX"
                />
              </div>
              <div>
                <Label className="text-xs">Business hours</Label>
                <Textarea
                  className="mt-1 min-h-[72px]"
                  value={guided.hours}
                  onChange={(e) =>
                    setGuided((g) => ({ ...g, hours: e.target.value }))
                  }
                  placeholder="Mon–Fri 9am–5pm, Sat 10am–2pm, closed Sunday"
                />
              </div>
              <div>
                <Label className="text-xs">Services</Label>
                <Textarea
                  className="mt-1 min-h-[72px]"
                  value={guided.services}
                  onChange={(e) =>
                    setGuided((g) => ({ ...g, services: e.target.value }))
                  }
                  placeholder="Cleanings, fillings, whitening…"
                />
              </div>
              <div>
                <Label className="text-xs">Pricing (optional)</Label>
                <Textarea
                  className="mt-1 min-h-[56px]"
                  value={guided.pricing}
                  onChange={(e) =>
                    setGuided((g) => ({ ...g, pricing: e.target.value }))
                  }
                  placeholder="Cleanings from $120…"
                />
              </div>
              <div>
                <Label className="text-xs">Policies (optional)</Label>
                <Textarea
                  className="mt-1 min-h-[56px]"
                  value={guided.policies}
                  onChange={(e) =>
                    setGuided((g) => ({ ...g, policies: e.target.value }))
                  }
                  placeholder="24h cancellation policy…"
                />
              </div>
              <button
                type="button"
                onClick={saveGuidedProfile}
                className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
              >
                Save profile to knowledge
              </button>
            </div>
          ) : null}

          {state.knowledgeSource === "upload_docs" ? (
            <div className="mt-3 rounded-xl border border-primary/30 bg-card p-4">
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".txt,.md,.csv,.json,.pdf,.doc,.docx,text/plain,text/csv,application/pdf"
                className="hidden"
                onChange={(e) => void onUploadFiles(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center rounded-xl border border-dashed border-border bg-card/50 px-4 py-8 text-center hover:bg-muted/40"
              >
                <CloudUpload className="h-6 w-6 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">Upload knowledge files</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Click to choose TXT/MD/CSV (best). PDF/DOCX names are saved —
                  paste key facts into an item below.
                </p>
              </button>
              {uploadNote ? (
                <p className="mt-2 text-xs text-success">{uploadNote}</p>
              ) : null}
            </div>
          ) : null}

          {state.knowledgeSource === "connect_data" ? (
            <div className="mt-3 rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              Connect CRM / Google Business later from Integrations. For this
              agent, use website scan or the guided profile so facts land in
              knowledge on Activate.
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          {state.knowledgeItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <FileText className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.summary}
                </p>
              </div>
              <StatusPill
                tone={
                  item.status === "complete"
                    ? "success"
                    : item.status === "warning"
                      ? "warning"
                      : "muted"
                }
              >
                {item.status === "complete" ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : item.status === "warning" ? (
                  <AlertTriangle className="h-3 w-3" />
                ) : null}
                {item.statusLabel}
              </StatusPill>
              <button
                type="button"
                onClick={() => openEdit(item)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Edit ${item.label}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        {editingId ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-lg">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Edit knowledge item</h3>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Label className="text-xs">Label</Label>
              <Input
                className="mt-1"
                value={editDraft.label}
                onChange={(e) =>
                  setEditDraft((d) => ({ ...d, label: e.target.value }))
                }
              />
              <Label className="mt-3 block text-xs">Facts the agent should know</Label>
              <Textarea
                className="mt-1 min-h-[140px]"
                value={editDraft.summary}
                onChange={(e) =>
                  setEditDraft((d) => ({ ...d, summary: e.target.value }))
                }
                placeholder="Hours, pricing, policies, directions…"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <SidePanel title="Knowledge quality">
        <ul className="space-y-3 text-xs">
          {state.knowledgeItems.map((item) => (
            <li key={item.id} className="flex items-start gap-2">
              {item.status === "complete" ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-success" />
              ) : (
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-warning" />
              )}
              <span>
                <span className="font-medium text-foreground">{item.label}</span>
                <span className="mt-0.5 block text-muted-foreground">
                  {item.status === "complete"
                    ? item.statusLabel
                    : "Configure so the AI can answer confidently"}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <InfoCallout>
          On save/activate, these facts are written into the agent knowledge base
          so Telnyx can answer without inventing details.
        </InfoCallout>
      </SidePanel>
    </div>
  );
}
