"use client";

import { useState } from "react";
import type {
  AppointmentReceptionistWizardState,
  KnowledgeItemStatus,
  KnowledgeSource,
} from "@/lib/solutions/appointment-receptionist/types";
import { Input, Label } from "@/components/ui/input";
import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  FileText,
  Globe,
  Link2,
  Pencil,
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
  deferredToActivate?: boolean;
}): KnowledgeItem[] {
  const { businessName, url, sourceStatus, chunkCount, preview, errorMessage, deferredToActivate } =
    input;

  if (deferredToActivate) {
    return [
      {
        id: "business",
        label: "Business details",
        summary: businessName
          ? `${businessName} · will import from website on activate`
          : "Will import from website on activate",
        status: "warning",
        statusLabel: "Pending activate",
      },
      {
        id: "hours",
        label: "Hours",
        summary: "Will be extracted when knowledge sync runs on activate",
        status: "warning",
        statusLabel: "Pending activate",
      },
      {
        id: "services",
        label: "Services",
        summary: `Queued URL: ${url}`,
        status: "warning",
        statusLabel: "Pending activate",
      },
      {
        id: "pricing",
        label: "Pricing",
        summary: "Review after website import completes",
        status: "warning",
        statusLabel: "Needs review",
      },
      {
        id: "faqs",
        label: "FAQs",
        summary: "Will import from website on activate",
        status: "warning",
        statusLabel: "Pending activate",
      },
      {
        id: "policies",
        label: "Policies",
        summary: "Configure cancellation and warranty policies",
        status: "warning",
        statusLabel: "Not configured",
      },
    ];
  }

  const status = (sourceStatus || "pending").toLowerCase();
  const indexed = status === "indexed" || status === "ready" || status === "active";
  const failed = status === "failed" || status === "error";
  const processing = status === "processing" || status === "pending";

  const itemStatus = (ok: boolean): KnowledgeItemStatus =>
    failed ? "warning" : ok && indexed ? "complete" : processing ? "warning" : "warning";

  const statusLabel = failed
    ? errorMessage?.slice(0, 48) || "Import failed"
    : indexed
      ? chunkCount
        ? `${chunkCount} chunks indexed`
        : "Indexed"
      : processing
        ? "Indexing…"
        : status;

  const previewBits = preview?.replace(/\s+/g, " ").trim().slice(0, 80);

  return [
    {
      id: "business",
      label: "Business details",
      summary: previewBits
        ? `${businessName || "Business"} · ${previewBits}`
        : `${businessName || "Business"} · source from ${url}`,
      status: itemStatus(true),
      statusLabel: indexed ? "Complete" : statusLabel,
    },
    {
      id: "hours",
      label: "Hours",
      summary: indexed
        ? "Check indexed content for hours — edit if incomplete"
        : "Waiting for website index to finish",
      status: itemStatus(false),
      statusLabel: indexed ? "Needs review" : statusLabel,
    },
    {
      id: "services",
      label: "Services",
      summary: indexed
        ? "Services may be in the crawled pages — verify in knowledge"
        : "Waiting for website index to finish",
      status: itemStatus(Boolean(indexed && (chunkCount || 0) > 0)),
      statusLabel: indexed ? (chunkCount ? `${chunkCount} chunks` : "Indexed") : statusLabel,
    },
    {
      id: "pricing",
      label: "Pricing",
      summary: "Pricing is rarely complete from a crawl — add prices manually",
      status: "warning",
      statusLabel: "Needs review",
    },
    {
      id: "faqs",
      label: "FAQs",
      summary: indexed
        ? "FAQ content may be included in the crawl — verify answers"
        : "Waiting for website index to finish",
      status: itemStatus(Boolean(indexed)),
      statusLabel: indexed ? "Needs review" : statusLabel,
    },
    {
      id: "policies",
      label: "Policies",
      summary: "Cancellation and warranty policies usually need manual setup",
      status: "warning",
      statusLabel: "Not configured",
    },
  ];
}

export function InformationStep({
  state,
  patch,
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  async function importWebsiteKnowledge() {
    const url = normalizeWebsiteUrl(state.websiteUrl);
    if (!url || scanning) return;

    setScanning(true);
    setScanError(null);

    const guessedName = guessBusinessNameFromUrl(url);
    const businessName = state.businessName || guessedName;

    // Optimistic scanning state
    patch({
      businessName,
      websiteUrl: url,
      knowledgeItems: state.knowledgeItems.map((item) => ({
        ...item,
        status: "warning" as const,
        statusLabel: "Scanning…",
        summary: item.id === "business" ? `Scanning ${url}` : item.summary,
      })),
    });

    try {
      const kbRes = await fetch("/api/voice/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${businessName || "Business"} Website`,
          description: `Wizard website import: ${url}`,
        }),
      });

      if (kbRes.status === 401 || kbRes.status === 403) {
        patch({
          businessName,
          websiteUrl: url,
          knowledgeItems: itemsForScanResult({
            businessName,
            url,
            deferredToActivate: true,
          }),
        });
        setScanError("Sign in required to scan now — URL will import on activate.");
        return;
      }

      if (!kbRes.ok) {
        const errJson = (await kbRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(errJson.error || `Knowledge create failed (${kbRes.status})`);
      }

      const kbJson = (await kbRes.json()) as { data?: { id?: string } };
      const kbId = kbJson.data?.id;
      if (!kbId) throw new Error("Knowledge base create returned no id");

      const sourceRes = await fetch(`/api/voice/knowledge/${kbId}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Wizard website",
          sourceType: "url",
          crawlUrl: url,
        }),
      });

      if (!sourceRes.ok) {
        const errJson = (await sourceRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(errJson.error || `URL source failed (${sourceRes.status})`);
      }

      const sourceJson = (await sourceRes.json()) as {
        data?: {
          status?: string;
          chunkCount?: number | null;
          extractedPreview?: string | null;
          contentText?: string | null;
          errorMessage?: string | null;
        };
      };
      const source = sourceJson.data;

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

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 space-y-8">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            What should your receptionist know?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your business information so your AI receptionist can answer with confidence.
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
              description="Walk through business details, hours, services, and policies."
              icon={<FileText className="h-4 w-4" />}
            />
            <SelectableCard
              selected={state.knowledgeSource === "upload_docs"}
              onClick={() => patch({ knowledgeSource: "upload_docs" })}
              title="Upload documents"
              description="PDF, DOCX, TXT, CSV — price lists, FAQs, handbooks."
              icon={<CloudUpload className="h-4 w-4" />}
            />
            <SelectableCard
              selected={state.knowledgeSource === "connect_data"}
              onClick={() => patch({ knowledgeSource: "connect_data" })}
              title="Connect existing data"
              description="CRM, Google Business Profile, help center, or knowledge base."
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
                <p className="truncate text-xs text-muted-foreground">{item.summary}</p>
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
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Edit ${item.label}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <div className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-8 text-center">
            <CloudUpload className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Knowledge base files (optional)</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Drag and drop PDF, DOCX, or TXT files up to 10MB
            </p>
          </div>
        </div>
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
                    : item.id === "pricing"
                      ? "Add pricing to help answer cost questions"
                      : "Configure so the AI can answer confidently"}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <InfoCallout>
          Your AI receptionist uses this information to answer questions accurately and
          represent your business. Behavior stays in the system prompt — facts stay here.
        </InfoCallout>
      </SidePanel>
    </div>
  );
}
