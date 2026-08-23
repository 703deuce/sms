"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Upload, Webhook, Zap } from "lucide-react";
import Link from "next/link";
import { CampaignTemplateGallery } from "@/components/reputation/campaign-template-gallery";
import { CampaignBuilder } from "@/components/reputation/campaign-builder";
import { cn } from "@/lib/utils";
import type { CampaignTriggerType } from "@/lib/reputation/campaign-triggers";

type EndpointRow = {
  id: string;
  name: string;
  default_event_type?: string;
  eventType?: string;
  is_active?: boolean;
  isActive?: boolean;
};

/**
 * Campaign creation starts with an explicit trigger choice, then template / builder.
 * Manual and webhook paths both end in the same enrollment engine.
 */
export function CampaignCreateWizard({
  businessId,
  onComplete,
  onCancel,
}: {
  businessId: string;
  onComplete?: (campaignId?: string) => void;
  onCancel?: () => void;
}) {
  const [step, setStep] = useState<"trigger" | "template" | "webhook" | "builder">("trigger");
  const [triggerType, setTriggerType] = useState<CampaignTriggerType | null>(null);
  const [endpoints, setEndpoints] = useState<EndpointRow[]>([]);
  const [endpointId, setEndpointId] = useState<string>("");
  const [eventType, setEventType] = useState("service.completed");
  const [loadingEndpoints, setLoadingEndpoints] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEndpoints = useCallback(async () => {
    setLoadingEndpoints(true);
    setError(null);
    try {
      const res = await fetch(`/api/integrations/webhooks?businessId=${businessId}`);
      const json = await res.json();
      if (res.ok) {
        const list = (json.endpoints ?? json.items ?? []) as EndpointRow[];
        setEndpoints(list);
        if (list[0]?.id) setEndpointId(list[0].id);
        const firstEventType = list[0]?.eventType ?? list[0]?.default_event_type;
        if (firstEventType) setEventType(String(firstEventType));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load webhook endpoints");
    } finally {
      setLoadingEndpoints(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (step === "webhook") queueMicrotask(() => void loadEndpoints());
  }, [step, loadEndpoints]);

  const chooseManual = () => {
    setTriggerType("manual");
    setStep("template");
  };

  const chooseAutomatic = () => {
    setTriggerType("webhook");
    setStep("webhook");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-zinc-900">Create campaign</p>
          <p className="text-[11px] text-zinc-500">
            A campaign defines what happens. A trigger defines when someone enters it.
          </p>
        </div>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-[12px] font-medium text-zinc-500 hover:text-zinc-800"
          >
            Close
          </button>
        ) : null}
      </div>

      {error ? <p className="text-[12px] text-red-600">{error}</p> : null}

      {step === "trigger" ? (
        <div className="space-y-2">
          <p className="text-[12px] font-semibold text-zinc-800">How should this campaign start?</p>
          <button
            type="button"
            onClick={chooseManual}
            className="flex w-full items-start gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-3 text-left hover:border-emerald-300 hover:bg-emerald-50/40"
          >
            <Upload className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              <span className="block text-[13px] font-semibold text-zinc-900">Start manually</span>
              <span className="mt-0.5 block text-[11px] text-zinc-500">
                Select or upload customers, then launch the campaign yourself. Timing starts when each
                recipient is enrolled.
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={chooseAutomatic}
            className="flex w-full items-start gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-3 text-left hover:border-emerald-300 hover:bg-emerald-50/40"
          >
            <Webhook className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              <span className="block text-[13px] font-semibold text-zinc-900">Start automatically</span>
              <span className="mt-0.5 block text-[11px] text-zinc-500">
                Enroll customers when your CRM, payment system, or automation tool sends an event.
              </span>
            </span>
          </button>

          <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/80 px-3 py-2">
            <p className="text-[11px] font-medium text-zinc-600">Available via webhook triggers</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {["Zapier", "Make", "n8n", "API"].map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-zinc-500 ring-1 ring-zinc-200"
                >
                  <Zap className="h-3 w-3" />
                  {label}
                </span>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-zinc-500">
              These connectors can send events to the webhook enrollment engine.
            </p>
          </div>
        </div>
      ) : null}

      {step === "webhook" && triggerType === "webhook" ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setStep("trigger")}
            className="text-[11px] font-medium text-zinc-500 hover:text-zinc-800"
          >
            ← Back
          </button>
          <p className="text-[12px] font-semibold text-zinc-800">Connect a webhook trigger</p>
          {loadingEndpoints ? (
            <div className="flex items-center gap-2 text-[12px] text-zinc-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading endpoints…
            </div>
          ) : endpoints.length ? (
            <label className="block text-[12px] font-medium text-zinc-700">
              Endpoint
              <select
                className="mt-1 w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-[13px]"
                value={endpointId}
                onChange={(e) => setEndpointId(e.target.value)}
              >
                {endpoints.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.name}
                    {(ep.isActive ?? ep.is_active) ? "" : " (inactive)"}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-[12px] text-zinc-600">
              No webhook endpoints yet.{" "}
              <Link
                href={`/businesses/${businessId}/reputation/automations`}
                className="font-medium text-emerald-700 underline"
              >
                Create one in Automations
              </Link>
              , then return here.
            </p>
          )}
          <label className="block text-[12px] font-medium text-zinc-700">
            Event that enrolls customers
            <select
              className="mt-1 w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-[13px]"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
            >
              {[
                "service.completed",
                "appointment.completed",
                "invoice.paid",
                "order.fulfilled",
                "contact.enroll",
              ].map((ev) => (
                <option key={ev} value={ev}>
                  {ev}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!endpointId}
            onClick={() => setStep("template")}
            className={cn(
              "rounded-full bg-[#137752] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#0f6344]",
              !endpointId && "opacity-50"
            )}
          >
            Continue to templates
          </button>
        </div>
      ) : null}

      {step === "template" && triggerType ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setStep(triggerType === "webhook" ? "webhook" : "trigger")}
            className="text-[11px] font-medium text-zinc-500 hover:text-zinc-800"
          >
            ← Back
          </button>
          <CampaignTemplateGallery
            businessId={businessId}
            triggerType={triggerType}
            webhookEndpointId={triggerType === "webhook" ? endpointId || null : null}
            triggerConfig={
              triggerType === "webhook"
                ? { eventType, endpointId: endpointId || null, allowManualEnrollment: true }
                : { allowManualEnrollment: true }
            }
            onCustom={() => setStep("builder")}
            onUsed={(campaignId) => onComplete?.(campaignId)}
          />
        </div>
      ) : null}

      {step === "builder" && triggerType ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setStep("template")}
            className="text-[11px] font-medium text-zinc-500 hover:text-zinc-800"
          >
            ← Back to templates
          </button>
          <CampaignBuilder
            businessId={businessId}
            triggerType={triggerType}
            triggerConfig={
              triggerType === "webhook"
                ? { eventType, endpointId: endpointId || null, allowManualEnrollment: true }
                : { allowManualEnrollment: true }
            }
            webhookEndpointId={triggerType === "webhook" ? endpointId || null : null}
            onComplete={() => onComplete?.()}
          />
        </div>
      ) : null}
    </div>
  );
}
