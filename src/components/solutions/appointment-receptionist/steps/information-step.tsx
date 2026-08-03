"use client";

import type {
  AppointmentReceptionistWizardState,
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

export function InformationStep({
  state,
  patch,
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
}) {
  function simulateWebsiteImport() {
    const url = state.websiteUrl.trim();
    if (!url) return;
    let host = url;
    try {
      host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(
        /^www\./,
        "",
      );
    } catch {
      // keep raw
    }
    const businessName = host
      .split(".")[0]
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    patch({
      businessName: state.businessName || businessName,
      knowledgeItems: [
        {
          id: "business",
          label: "Business details",
          summary: `${businessName} · imported from website`,
          status: "complete",
          statusLabel: "Complete",
        },
        {
          id: "hours",
          label: "Hours",
          summary: "Mon–Fri 8:00 AM–6:00 PM · Sat 9:00 AM–1:00 PM",
          status: "complete",
          statusLabel: "Complete",
        },
        {
          id: "services",
          label: "Services",
          summary: "Core services detected from your site",
          status: "complete",
          statusLabel: "8 added",
        },
        {
          id: "pricing",
          label: "Pricing",
          summary: "Some services still need prices",
          status: "warning",
          statusLabel: "3 services missing prices",
        },
        {
          id: "faqs",
          label: "FAQs",
          summary: "Common questions imported",
          status: "complete",
          statusLabel: "12 questions added",
        },
        {
          id: "policies",
          label: "Policies",
          summary: "Cancellation and warranty policies",
          status: "warning",
          statusLabel: "Not configured",
        },
      ],
    });
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
            >
              {state.knowledgeSource === "website" ? (
                <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                  <Label htmlFor="website-url" className="text-xs">
                    Business website URL
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="website-url"
                      value={state.websiteUrl}
                      onChange={(e) => patch({ websiteUrl: e.target.value })}
                      placeholder="https://www.example.com"
                    />
                    <button
                      type="button"
                      onClick={simulateWebsiteImport}
                      className="shrink-0 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground"
                    >
                      Scan
                    </button>
                  </div>
                </div>
              ) : null}
            </SelectableCard>
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
