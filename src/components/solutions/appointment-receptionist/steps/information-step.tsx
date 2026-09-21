"use client";

import { useEffect, useRef, useState } from "react";
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
import { BusinessScheduleEditor } from "../operating-maturity-editor";
import { BusinessAutoSetupPanel } from "../business-auto-setup-panel";

type KnowledgeItem = AppointmentReceptionistWizardState["knowledgeItems"][number];

function ConnectExistingKnowledge({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [rows, setRows] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/voice/knowledge");
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "Failed to load knowledge bases");
        if (!cancelled) {
          setRows(
            (json?.data || []).map((r: { id: string; name: string }) => ({
              id: r.id,
              name: r.name,
            })),
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-primary/30 bg-card p-4 text-sm">
      <p className="font-medium">Connect existing knowledge</p>
      <p className="text-xs text-muted-foreground">
        Attach a knowledge base already in this workspace. It is linked to the
        agent on save/activate. You can also open Integrations for CRM.
      </p>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading knowledge bases…</p>
      ) : error ? (
        <p className="text-xs text-warning">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No knowledge bases yet — use Guided profile or Upload first.
        </p>
      ) : (
        <select
          className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
          value={selectedId || ""}
          onChange={(e) => onSelect(e.target.value || null)}
        >
          <option value="">Select a knowledge base…</option>
          {rows.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      )}
      <div className="flex flex-wrap gap-2">
        <a
          href="/integrations"
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
        >
          Open Integrations
        </a>
        <a
          href="/voice/knowledge"
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium"
        >
          Open Knowledge bases
        </a>
      </div>
    </div>
  );
}

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
      status: ok ? "extracted" : "warning",
      statusLabel: ok ? "Extracted — approve to use" : "Partial import — needs review",
    },
    {
      id: "hours",
      label: "Hours",
      summary: preview
        ? preview.slice(0, 160)
        : "Review hours on your site or edit this item",
      status: ok ? "extracted" : "warning",
      statusLabel: ok ? "Extracted — approve to use" : "Needs review",
    },
    {
      id: "services",
      label: "Services",
      summary: ok
        ? "Services and offerings from your website"
        : input.errorMessage || "Scan incomplete",
      status: ok ? "extracted" : "warning",
      statusLabel: ok ? "Extracted — approve to use" : "Needs review",
    },
    {
      id: "pricing",
      label: "Pricing",
      summary: "Add pricing so the AI can answer cost questions",
      status: "optional",
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
  presentation = "legacy",
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
  presentation?: "legacy" | "mctb";
}) {
  const isMctb = presentation === "mctb";
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
          knowledgeBaseId: state.linkedKnowledgeBaseId || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Website scan failed");
      }
      const payload = json?.data || {};
      const source = payload?.source || payload;
      patch({
        businessName,
        websiteUrl: url,
        linkedKnowledgeBaseId:
          payload.knowledgeBaseId || state.linkedKnowledgeBaseId || null,
        knowledgeItems: itemsForScanResult({
          businessName,
          url,
          sourceStatus: source?.status || payload.sourceStatus,
          chunkCount: source?.chunkCount ?? payload.chunkCount,
          preview:
            source?.extractedPreview ||
            source?.contentText ||
            payload.extractedPreview,
          errorMessage: source?.errorMessage || payload.errorMessage,
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

  async function ensureWizardKnowledgeBase(): Promise<string> {
    if (state.linkedKnowledgeBaseId) return state.linkedKnowledgeBaseId;
    const name = `${state.solutionName || "Agent"} Knowledge`;
    const res = await fetch("/api/voice/knowledge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        description: "Created from appointment receptionist wizard",
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || "Could not create knowledge base");
    const id = String(json?.data?.id || "");
    if (!id) throw new Error("Knowledge base id missing");
    patch({ linkedKnowledgeBaseId: id });
    return id;
  }

  async function onUploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploadNote("");
    let items = [...state.knowledgeItems];
    let kbId = state.linkedKnowledgeBaseId || null;
    let uploaded = 0;
    let warned = 0;

    for (const file of Array.from(files)) {
      const lower = file.name.toLowerCase();
      const isText =
        file.type.startsWith("text/") ||
        /\.(txt|md|csv|json)$/i.test(lower);
      const isBinaryDoc = /\.(pdf|docx?)$/i.test(lower);

      if (isText) {
        const text = (await file.text()).slice(0, 20_000);
        items = upsertItem(items, `file-${file.name}`, {
          label: file.name,
          summary: text.slice(0, 2000),
          status: "complete",
          statusLabel: "Uploaded",
        });
        uploaded += 1;
        continue;
      }

      if (isBinaryDoc) {
        try {
          if (!kbId) kbId = await ensureWizardKnowledgeBase();
          const form = new FormData();
          form.append("file", file);
          const res = await fetch(`/api/voice/knowledge/${kbId}/upload`, {
            method: "POST",
            body: form,
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(json?.error || "Upload failed");
          }
          const src = json?.data;
          items = upsertItem(items, `file-${file.name}`, {
            label: file.name,
            summary:
              (src?.extractedPreview || src?.contentText || "").slice(0, 500) ||
              `Indexed for RAG (${file.type || "document"})`,
            status:
              src?.status === "indexed" || src?.status === "ready"
                ? "complete"
                : "warning",
            statusLabel:
              src?.status === "indexed" || src?.status === "ready"
                ? "Uploaded & indexed"
                : "Uploaded — indexing",
          });
          uploaded += 1;
        } catch (err) {
          warned += 1;
          items = upsertItem(items, `file-${file.name}`, {
            label: file.name,
            summary:
              err instanceof Error
                ? err.message
                : "Upload failed — paste key facts below",
            status: "warning",
            statusLabel: "Upload failed",
          });
        }
        continue;
      }

      warned += 1;
      items = upsertItem(items, `file-${file.name}`, {
        label: file.name,
        summary: `Unsupported type (${file.type || "binary"}). Use PDF, DOCX, TXT, MD, or CSV.`,
        status: "warning",
        statusLabel: "Unsupported",
      });
    }

    patch({
      knowledgeItems: items,
      knowledgeSource: "upload_docs",
      linkedKnowledgeBaseId: kbId || state.linkedKnowledgeBaseId,
      knowledgeBaseEnabled: state.knowledgeBaseEnabled === false ? false : true,
    });
    setUploadNote(
      `${uploaded} file(s) added${warned ? `, ${warned} need attention` : ""}.`,
    );
    if (fileRef.current) fileRef.current.value = "";
  }

  function saveGuidedProfile(nextGuided = guided) {
    let items = [...state.knowledgeItems];
    const biz = nextGuided.businessName.trim() || state.businessName;
    if (biz) {
      items = upsertItem(items, "business", {
        label: "Business details",
        summary: [biz, nextGuided.address.trim()].filter(Boolean).join(" · "),
        status: "complete",
        statusLabel: "Configured",
      });
    }
    if (nextGuided.hours.trim()) {
      items = upsertItem(items, "hours", {
        label: "Hours",
        summary: nextGuided.hours.trim(),
        status: "complete",
        statusLabel: "Configured",
      });
    }
    if (nextGuided.services.trim()) {
      items = upsertItem(items, "services", {
        label: "Services",
        summary: nextGuided.services.trim(),
        status: "complete",
        statusLabel: "Configured",
      });
    }
    if (nextGuided.pricing.trim()) {
      items = upsertItem(items, "pricing", {
        label: "Pricing",
        summary: nextGuided.pricing.trim(),
        status: "complete",
        statusLabel: "Configured",
      });
    }
    if (nextGuided.policies.trim()) {
      items = upsertItem(items, "policies", {
        label: "Policies",
        summary: nextGuided.policies.trim(),
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

  function updateGuided<K extends keyof typeof guided>(key: K, value: string) {
    const next = { ...guided, [key]: value };
    setGuided(next);
    // Keep wizard knowledgeItems in sync without requiring a separate Save click
    // (Playwright/browser fills update the DOM; onChange keeps React state + agent knowledge).
    saveGuidedProfile(next);
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
            {isMctb ? "Business Knowledge" : "What should your agent know?"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add business information so the AI can answer with confidence. Facts
            here are written into the agent knowledge on save/activate.
          </p>
          <div className="mt-4">
            <BusinessAutoSetupPanel state={state} onStateChange={patch} />
          </div>
          <div className="mt-4 rounded-xl border border-border bg-card p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border"
                checked={state.knowledgeBaseEnabled !== false}
                onChange={(e) =>
                  patch({
                    knowledgeBaseEnabled: e.target.checked,
                  })
                }
              />
              <span className="min-w-0">
                <span className="text-sm font-medium">
                  Search uploaded documents during calls
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Hours, services, and FAQs in your profile below are always
                  available immediately. Turn this on to let Amy search PDFs and
                  other indexed documents when a caller asks something not covered
                  there.
                </span>
              </span>
            </label>
            {state.knowledgeBaseEnabled === false ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Large document search is off. Prompt facts and FAQs still work.
              </p>
            ) : !state.linkedKnowledgeBaseId &&
              state.knowledgeSource !== "upload_docs" &&
              state.knowledgeSource !== "website" &&
              state.knowledgeSource !== "connect_data" ? (
              <p className="mt-2 text-xs text-warning">
                Upload a document, scan a website, or connect a knowledge base to
                enable document search.
              </p>
            ) : null}
          </div>
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
              description="PDF, DOCX, TXT, MD, CSV — indexed into agent knowledge."
              icon={<CloudUpload className="h-4 w-4" />}
            />
            <SelectableCard
              selected={state.knowledgeSource === "connect_data"}
              onClick={() => patch({ knowledgeSource: "connect_data" })}
              title="Connect existing data"
              description="Attach an existing knowledge base or open Integrations."
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
                  onChange={(e) => updateGuided("businessName", e.target.value)}
                  placeholder="Acme Dental"
                />
              </div>
              <div>
                <Label className="text-xs">Address / locations</Label>
                <Input
                  className="mt-1"
                  value={guided.address}
                  onChange={(e) => updateGuided("address", e.target.value)}
                  placeholder="123 Main St, Austin TX"
                />
              </div>
              <div>
                <Label className="text-xs">Business hours</Label>
                <Textarea
                  className="mt-1 min-h-[72px]"
                  value={guided.hours}
                  onChange={(e) => updateGuided("hours", e.target.value)}
                  placeholder="Mon–Fri 9am–5pm, Sat 10am–2pm, closed Sunday"
                />
              </div>
              <div>
                <Label className="text-xs">Services</Label>
                <Textarea
                  className="mt-1 min-h-[72px]"
                  value={guided.services}
                  onChange={(e) => updateGuided("services", e.target.value)}
                  placeholder="Cleanings, fillings, whitening…"
                />
              </div>
              <div>
                <Label className="text-xs">Pricing (optional)</Label>
                <Textarea
                  className="mt-1 min-h-[56px]"
                  value={guided.pricing}
                  onChange={(e) => updateGuided("pricing", e.target.value)}
                  placeholder="Cleanings from $120…"
                />
              </div>
              <div>
                <Label className="text-xs">Policies (optional)</Label>
                <Textarea
                  className="mt-1 min-h-[56px]"
                  value={guided.policies}
                  onChange={(e) => updateGuided("policies", e.target.value)}
                  placeholder="24h cancellation policy…"
                />
              </div>
              <button
                type="button"
                onClick={() => saveGuidedProfile()}
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
                  PDF, DOCX, TXT, MD, CSV — PDFs upload to your knowledge base for
                  Telnyx RAG.
                </p>
              </button>
              {uploadNote ? (
                <p className="mt-2 text-xs text-success">{uploadNote}</p>
              ) : null}
            </div>
          ) : null}

          {state.knowledgeSource === "connect_data" ? (
            <ConnectExistingKnowledge
              selectedId={state.linkedKnowledgeBaseId || null}
              onSelect={(id) => {
                patch({
                  linkedKnowledgeBaseId: id,
                  knowledgeBaseEnabled: id
                    ? state.knowledgeBaseEnabled === false
                      ? false
                      : true
                    : state.knowledgeBaseEnabled,
                  knowledgeItems: upsertItem(state.knowledgeItems, "linked-kb", {
                    label: "Linked knowledge base",
                    summary: id
                      ? `Attached knowledge base ${id}`
                      : "No knowledge base selected",
                    status: id ? "complete" : "missing",
                    statusLabel: id ? "Linked" : "Not linked",
                  }),
                });
              }}
            />
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
                    : item.status === "pending_review" || item.status === "warning"
                      ? "warning"
                      : "muted"
                }
              >
                {item.status === "complete" ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : item.status === "warning" || item.status === "pending_review" ? (
                  <AlertTriangle className="h-3 w-3" />
                ) : null}
                {item.statusLabel}
              </StatusPill>
              {item.status === "pending_review" || item.status === "extracted" ? (
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      knowledgeItems: state.knowledgeItems.map((i) =>
                        i.id === item.id
                          ? {
                              ...i,
                              status: "owner_approved",
                              statusLabel: "Approved",
                            }
                          : i,
                      ),
                    })
                  }
                  className="rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted"
                >
                  Approve
                </button>
              ) : null}
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

        {state.knowledgeItems.some(
          (i) => i.status === "pending_review" || i.status === "extracted",
        ) ? (
          <button
            type="button"
            onClick={() =>
              patch({
                knowledgeItems: state.knowledgeItems.map((i) =>
                  i.status === "pending_review" || i.status === "extracted"
                    ? { ...i, status: "owner_approved", statusLabel: "Approved" }
                    : i,
                ),
              })
            }
            className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
          >
            Approve all imported facts for shared brain
          </button>
        ) : null}

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

        <BusinessScheduleEditor state={state} patch={patch} />
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
