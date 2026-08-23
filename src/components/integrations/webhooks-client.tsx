"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Loader2, Plus, Webhook } from "lucide-react";
import { ModuleHeader, ModulePage } from "@/components/ui/design-system";
import { cn } from "@/lib/utils";
import {
  applyFieldMapping,
  detectFieldMapping,
  type FieldMapping,
} from "@/lib/integrations/webhook-mapping";

type EndpointRow = {
  id: string;
  name: string;
  businessId: string | null;
  campaignId: string | null;
  eventType: string;
  isTest: boolean;
  isActive: boolean;
  tokenLastFour: string;
  lastReceivedAt: string | null;
  createdAt: string;
};

type CampaignOpt = { id: string; name: string; status: string };

type Metrics = {
  active: number;
  eventsThisMonth: number;
  successful: number;
  failed: number;
};

type MatchRow = {
  id: string;
  eventId: string;
  endpointId: string;
  reason: string;
  candidates: Array<{
    id: string;
    matchVia?: string;
    customerName?: string | null;
    email?: string | null;
    phone?: string | null;
  }>;
  incoming: {
    externalId: string | null;
    email: string | null;
    phone: string | null;
    name: string | null;
  };
  createdAt: string;
};

function MicroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[calc(50%-0.25rem)] flex-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 sm:min-w-[6.5rem] sm:flex-none">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-zinc-900">{value}</p>
    </div>
  );
}

const STEPS = ["Name", "Trigger", "Mapping", "Security", "Activate"] as const;

export function WebhooksClient({
  businessId,
  embedded = false,
}: {
  businessId: string;
  embedded?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [endpoints, setEndpoints] = useState<EndpointRow[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignOpt[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("Job completed → Review campaign");
  const [campaignId, setCampaignId] = useState("");
  const [eventType, setEventType] = useState("service.completed");
  const [isTest, setIsTest] = useState(true);
  const [delayMinutes, setDelayMinutes] = useState(120);
  const [duplicateWindowDays, setDuplicateWindowDays] = useState(90);
  const [contactUpdateMode, setContactUpdateMode] = useState("upsert");
  const [requireEmailConsent, setRequireEmailConsent] = useState(false);
  const [requireSmsConsent, setRequireSmsConsent] = useState(false);
  const [signatureRequired, setSignatureRequired] = useState(false);
  const [sampleJson, setSampleJson] = useState("");
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [resolvingMatchId, setResolvingMatchId] = useState<string | null>(null);
  const detailRequestRef = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [wh, camps, matchRes] = await Promise.all([
        fetch(`/api/integrations/webhooks?businessId=${businessId}`),
        fetch(`/api/reputation/review-requests/campaigns?businessId=${businessId}`),
        fetch(`/api/integrations/webhooks/matches?businessId=${businessId}`),
      ]);
      const whJson = await wh.json();
      const campJson = await camps.json();
      const matchJson = await matchRes.json();
      if (!wh.ok) throw new Error(whJson.error || "Failed to load webhooks");
      setEndpoints(whJson.endpoints ?? []);
      setMetrics(whJson.metrics ?? null);
      if (!camps.ok) {
        throw new Error(campJson.error || "Failed to load campaigns");
      }
      const list = (campJson.campaigns ?? []) as Array<{ id: string; name: string; status: string }>;
      const eligible = list.filter((c) => ["active", "scheduled"].includes(c.status));
      setCampaigns(eligible);
      setCampaignId((prev) =>
        prev && eligible.some((c) => c.id === prev) ? prev : eligible[0]?.id || ""
      );
      if (matchRes.ok) setMatches(matchJson.matches ?? []);
      else setMatches([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const previewNormalized = useMemo(() => {
    if (!sampleJson.trim()) return null;
    try {
      const parsed = JSON.parse(sampleJson) as Record<string, unknown>;
      return applyFieldMapping(parsed, fieldMapping, { eventType });
    } catch {
      return null;
    }
  }, [sampleJson, fieldMapping, eventType]);

  function resetWizard() {
    setWizardStep(0);
    setName("Job completed → Review campaign");
    setEventType("service.completed");
    setIsTest(true);
    setDelayMinutes(120);
    setDuplicateWindowDays(90);
    setContactUpdateMode("upsert");
    setRequireEmailConsent(false);
    setRequireSmsConsent(false);
    setSignatureRequired(false);
    setSampleJson("");
    setSampleError(null);
    setFieldMapping({});
  }

  function openWizard() {
    resetWizard();
    setShowCreate(true);
  }

  function detectFromSample() {
    setSampleError(null);
    try {
      const parsed = JSON.parse(sampleJson) as unknown;
      const detected = detectFieldMapping(parsed);
      setFieldMapping(detected);
      if (!Object.keys(detected).length) {
        setSampleError("No obvious contact fields found — map paths manually below.");
      }
    } catch {
      setSampleError("Paste valid JSON from Zapier/Make/n8n.");
    }
  }

  async function createEndpoint() {
    setCreating(true);
    setError(null);
    setCreatedUrl(null);
    setCreatedSecret(null);
    try {
      const res = await fetch("/api/integrations/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          campaignId,
          name,
          eventType,
          isTest,
          sendDelayMinutes: Number.isFinite(delayMinutes) ? Math.max(0, delayMinutes) : 0,
          duplicateWindowDays: Number.isFinite(duplicateWindowDays)
            ? Math.max(0, duplicateWindowDays)
            : 90,
          signatureRequired,
          fieldMapping,
          contactUpdateMode,
          requireEmailConsent,
          requireSmsConsent,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Create failed");
      setCreatedUrl(json.webhookUrl);
      setCreatedSecret(json.signingSecret ?? null);
      setShowCreate(false);
      resetWizard();
      await load();
      if (json.endpoint?.id) void openDetail(json.endpoint.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function openDetail(id: string) {
    const requestId = ++detailRequestRef.current;
    setSelectedId(id);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(
        `/api/integrations/webhooks/${id}?businessId=${businessId}`
      );
      const json = await res.json();
      if (requestId !== detailRequestRef.current) return;
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setDetail(json);
    } catch (err) {
      if (requestId !== detailRequestRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to load detail");
      setSelectedId(null);
      setDetail(null);
    } finally {
      if (requestId === detailRequestRef.current) setDetailLoading(false);
    }
  }

  async function patchAction(id: string, action?: string, extra?: Record<string, unknown>) {
    setError(null);
    try {
      const res = await fetch(
        `/api/integrations/webhooks/${id}?businessId=${businessId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action ? { action, ...extra } : { ...extra }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed");
      if (json.webhookUrl) setCreatedUrl(json.webhookUrl);
      if (json.signingSecret) setCreatedSecret(json.signingSecret);
      await load();
      if (action === "revoke") {
        setSelectedId(null);
        setDetail(null);
        return;
      }
      await openDetail(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  async function resolveMatch(matchId: string, action: "link" | "skip", contactId?: string) {
    if (resolvingMatchId) return;
    setError(null);
    setResolvingMatchId(matchId);
    try {
      const res = await fetch("/api/integrations/webhooks/matches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, matchId, action, contactId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Resolve failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resolve failed");
    } finally {
      setResolvingMatchId(null);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  const canNext =
    wizardStep === 0
      ? Boolean(name.trim() && campaignId)
      : wizardStep === 1
        ? Boolean(eventType)
        : true;

  const endpoint = detail?.endpoint as Record<string, unknown> | undefined;
  const events = (detail?.events as Array<Record<string, unknown>>) ?? [];
  const sample = detail?.samplePayload as Record<string, unknown> | undefined;
  const campaignName = campaigns.find((c) => c.id === campaignId)?.name ?? "—";

  const content = (
    <>
      {!embedded ? (
        <ModuleHeader
          title="Automations"
          subtitle="When a job, invoice, or appointment completes in your CRM, enroll the customer in a Review Campaign — via Zapier, Make, n8n, or custom HTTP."
          icon={Webhook}
          actions={
            <button
              type="button"
              onClick={openWizard}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-zinc-800 hover:bg-zinc-50"
            >
              <Plus className="h-3.5 w-3.5" /> New trigger
            </button>
          }
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-zinc-900">Triggers</h2>
            <p className="text-[12px] text-zinc-500">
              Webhook triggers that enroll customers into active review campaigns.
            </p>
          </div>
          <button
            type="button"
            onClick={openWizard}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-zinc-800 hover:bg-zinc-50"
          >
            <Plus className="h-3.5 w-3.5" /> New trigger
          </button>
        </div>
      )}

      {metrics ? (
        <div className="mb-3 flex flex-wrap gap-2">
          <MicroStat label="Active" value={String(metrics.active)} />
          <MicroStat label="Events (mo)" value={String(metrics.eventsThisMonth)} />
          <MicroStat label="Successful" value={String(metrics.successful)} />
          <MicroStat label="Failed" value={String(metrics.failed)} />
        </div>
      ) : null}

      {createdUrl ? (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px]">
          <p className="font-semibold text-amber-900">Copy your webhook URL now</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 break-all text-amber-950">{createdUrl}</code>
            <button type="button" onClick={() => void copy(createdUrl)} className="rounded border border-amber-300 bg-white p-1">
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          {createdSecret ? (
            <p className="mt-1 break-all text-amber-900">
              Signing secret: <code>{createdSecret}</code>
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mb-2 text-[12px] text-red-600">{error}</p> : null}

      {matches.length > 0 ? (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50/60 p-3">
          <p className="text-[13px] font-semibold text-amber-950">
            Contact match review ({matches.length})
          </p>
          <p className="mt-0.5 text-[11px] text-amber-900/80">
            These triggers matched more than one contact. Pick the right person before a review request is sent.
          </p>
          <ul className="mt-2 space-y-2">
            {matches.map((m) => (
              <li key={m.id} className="rounded border border-amber-200 bg-white px-2.5 py-2 text-[11px]">
                <p className="font-medium text-zinc-900">
                  {m.incoming.name || m.incoming.email || m.incoming.phone || "Incoming contact"}
                </p>
                <p className="text-zinc-600">{m.reason}</p>
                <p className="mt-0.5 text-zinc-500">
                  Incoming: {[m.incoming.externalId, m.incoming.email, m.incoming.phone]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(Array.isArray(m.candidates) ? m.candidates : []).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      disabled={resolvingMatchId === m.id}
                      className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] hover:bg-zinc-100 disabled:opacity-50"
                      onClick={() => void resolveMatch(m.id, "link", c.id)}
                    >
                      Use {c.customerName || c.email || c.phone || c.id.slice(0, 8)}
                      {c.matchVia ? ` (${c.matchVia})` : ""}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={resolvingMatchId === m.id}
                    className="rounded border border-zinc-200 px-2 py-1 text-[11px] text-zinc-600 disabled:opacity-50"
                    onClick={() => void resolveMatch(m.id, "skip")}
                  >
                    Skip
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showCreate ? (
        <div className="mb-3 rounded-md border border-zinc-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-zinc-900">Create Automatic Review Trigger</p>
            <p className="text-[11px] text-zinc-500">
              Step {wizardStep + 1} of {STEPS.length}: {STEPS[wizardStep]}
            </p>
          </div>
          <div className="mt-2 flex gap-1">
            {STEPS.map((label, i) => (
              <div
                key={label}
                className={cn(
                  "h-1 flex-1 rounded-full",
                  i <= wizardStep ? "bg-zinc-900" : "bg-zinc-200"
                )}
              />
            ))}
          </div>

          {wizardStep === 0 ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="block text-[12px] sm:col-span-2">
                <span className="text-zinc-500">Name</span>
                <input
                  className="mt-0.5 w-full rounded border border-zinc-200 px-2 py-1.5 text-[13px]"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="block text-[12px] sm:col-span-2">
                <span className="text-zinc-500">Review Campaign</span>
                <select
                  className="mt-0.5 w-full rounded border border-zinc-200 px-2 py-1.5 text-[13px]"
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                >
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.status})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {wizardStep === 1 ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="block text-[12px]">
                <span className="text-zinc-500">Trigger event</span>
                <select
                  className="mt-0.5 w-full rounded border border-zinc-200 px-2 py-1.5 text-[13px]"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                >
                  <option value="service.completed">service.completed</option>
                  <option value="appointment.completed">appointment.completed</option>
                  <option value="invoice.paid">invoice.paid</option>
                  <option value="order.fulfilled">order.fulfilled</option>
                  <option value="contact.enroll">contact.enroll</option>
                </select>
              </label>
              <label className="block text-[12px]">
                <span className="text-zinc-500">Send delay (minutes)</span>
                <input
                  type="number"
                  min={0}
                  className="mt-0.5 w-full rounded border border-zinc-200 px-2 py-1.5 text-[13px]"
                  value={delayMinutes}
                  onChange={(e) => setDelayMinutes(Number(e.target.value))}
                />
              </label>
              <label className="block text-[12px]">
                <span className="text-zinc-500">Duplicate window (days)</span>
                <input
                  type="number"
                  min={0}
                  className="mt-0.5 w-full rounded border border-zinc-200 px-2 py-1.5 text-[13px]"
                  value={duplicateWindowDays}
                  onChange={(e) => setDuplicateWindowDays(Number(e.target.value))}
                />
              </label>
              <label className="flex items-center gap-2 pt-5 text-[12px] text-zinc-700">
                <input type="checkbox" checked={isTest} onChange={(e) => setIsTest(e.target.checked)} />
                Start in test mode (no real sends)
              </label>
            </div>
          ) : null}

          {wizardStep === 2 ? (
            <div className="mt-3 space-y-2">
              <label className="block text-[12px]">
                <span className="text-zinc-500">Paste a sample JSON payload (optional)</span>
                <textarea
                  className="mt-0.5 h-28 w-full rounded border border-zinc-200 px-2 py-1.5 font-mono text-[11px]"
                  value={sampleJson}
                  onChange={(e) => setSampleJson(e.target.value)}
                  placeholder='{"customer":{"email":"a@b.com","phone":"+1555…"},"event_id":"job_1"}'
                />
              </label>
              <button
                type="button"
                onClick={detectFromSample}
                className="rounded border border-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-800 hover:bg-zinc-50"
              >
                Auto-detect field mapping
              </button>
              {sampleError ? <p className="text-[11px] text-amber-700">{sampleError}</p> : null}
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["email", "Email path"],
                    ["phone", "Phone path"],
                    ["first_name", "First name path"],
                    ["last_name", "Last name path"],
                    ["name", "Full name path"],
                    ["external_customer_id", "External customer id path"],
                    ["event_id", "Event id path"],
                  ] as Array<[keyof FieldMapping, string]>
                ).map(([key, label]) => (
                  <label key={key} className="block text-[12px]">
                    <span className="text-zinc-500">{label}</span>
                    <input
                      className="mt-0.5 w-full rounded border border-zinc-200 px-2 py-1.5 font-mono text-[11px]"
                      value={fieldMapping[key] ?? ""}
                      onChange={(e) =>
                        setFieldMapping((prev) => ({
                          ...prev,
                          [key]: e.target.value || undefined,
                        }))
                      }
                      placeholder="e.g. data.client.email"
                    />
                  </label>
                ))}
              </div>
              <label className="block text-[12px]">
                <span className="text-zinc-500">Contact update mode</span>
                <select
                  className="mt-0.5 w-full rounded border border-zinc-200 px-2 py-1.5 text-[13px] sm:max-w-xs"
                  value={contactUpdateMode}
                  onChange={(e) => setContactUpdateMode(e.target.value)}
                >
                  <option value="upsert">Upsert (create or update)</option>
                  <option value="create_only">Create only</option>
                  <option value="update_only">Update only</option>
                  <option value="skip_existing">Skip existing</option>
                </select>
              </label>
              <div className="flex flex-wrap gap-4 text-[12px] text-zinc-700">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={requireEmailConsent}
                    onChange={(e) => setRequireEmailConsent(e.target.checked)}
                  />
                  Require email consent
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={requireSmsConsent}
                    onChange={(e) => setRequireSmsConsent(e.target.checked)}
                  />
                  Require SMS consent
                </label>
              </div>
              {previewNormalized ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase text-zinc-500">Preview</p>
                  <pre className="mt-1 max-h-36 overflow-auto rounded border border-zinc-100 bg-zinc-50 p-2 text-[10px] text-zinc-700">
                    {JSON.stringify(previewNormalized.customer, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : null}

          {wizardStep === 3 ? (
            <div className="mt-3 space-y-2 text-[12px]">
              <label className="flex cursor-pointer items-start gap-2 rounded border border-zinc-200 p-2.5">
                <input
                  type="radio"
                  className="mt-0.5"
                  checked={!signatureRequired}
                  onChange={() => setSignatureRequired(false)}
                />
                <span>
                  <span className="font-medium text-zinc-900">Simple URL token</span>
                  <span className="mt-0.5 block text-zinc-500">
                    Long unguessable URL. Best for Zapier / Make / n8n.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded border border-zinc-200 p-2.5">
                <input
                  type="radio"
                  className="mt-0.5"
                  checked={signatureRequired}
                  onChange={() => setSignatureRequired(true)}
                />
                <span>
                  <span className="font-medium text-zinc-900">Signed requests (HMAC)</span>
                  <span className="mt-0.5 block text-zinc-500">
                    Require X-LSE-Timestamp + X-LSE-Signature. You&apos;ll get a signing secret once.
                  </span>
                </span>
              </label>
            </div>
          ) : null}

          {wizardStep === 4 ? (
            <div className="mt-3 space-y-1.5 rounded border border-zinc-100 bg-zinc-50 px-3 py-2 text-[12px] text-zinc-700">
              <p>
                <span className="text-zinc-500">Name:</span> {name}
              </p>
              <p>
                <span className="text-zinc-500">Campaign:</span> {campaignName}
              </p>
              <p>
                <span className="text-zinc-500">Event:</span> {eventType} · delay {delayMinutes}m ·
                duplicate {duplicateWindowDays}d
              </p>
              <p>
                <span className="text-zinc-500">Mode:</span> {isTest ? "Test" : "Live"} ·{" "}
                {signatureRequired ? "Signed" : "Simple URL"} · contacts {contactUpdateMode}
              </p>
              <p>
                <span className="text-zinc-500">Mapped fields:</span>{" "}
                {Object.keys(fieldMapping).length
                  ? Object.keys(fieldMapping).join(", ")
                  : "defaults / aliases"}
              </p>
              <p className="pt-1 text-[11px] text-zinc-500">
                Creating activates the endpoint. Copy the URL on the next screen — it is shown only once.
              </p>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            {wizardStep > 0 ? (
              <button
                type="button"
                onClick={() => setWizardStep((s) => s - 1)}
                className="rounded-md border border-zinc-200 px-3 py-1.5 text-[12px]"
              >
                Back
              </button>
            ) : null}
            {wizardStep < STEPS.length - 1 ? (
              <button
                type="button"
                disabled={!canNext}
                onClick={() => setWizardStep((s) => s + 1)}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                disabled={creating || !campaignId}
                onClick={() => void createEndpoint()}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create & copy URL"}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                resetWizard();
              }}
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-[12px]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
        <table className="min-w-full text-left text-[12px]">
          <thead className="border-b border-zinc-100 bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-2.5 py-1.5 font-medium">Name</th>
              <th className="px-2.5 py-1.5 font-medium">Event</th>
              <th className="px-2.5 py-1.5 font-medium">Env</th>
              <th className="px-2.5 py-1.5 font-medium">Status</th>
              <th className="px-2.5 py-1.5 font-medium">Last received</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-2.5 py-4 text-zinc-500">
                  <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> Loading…
                </td>
              </tr>
            ) : endpoints.length ? (
              endpoints.map((e) => (
                <tr
                  key={e.id}
                  className={cn(
                    "cursor-pointer border-b border-zinc-50 hover:bg-zinc-50",
                    selectedId === e.id && "bg-zinc-50"
                  )}
                  onClick={() => void openDetail(e.id)}
                >
                  <td className="px-2.5 py-2 font-medium text-zinc-900">
                    <span className="inline-flex items-center gap-1">
                      <Webhook className="h-3 w-3 text-zinc-400" />
                      {e.name}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-zinc-400">
                      …{e.tokenLastFour}
                    </span>
                  </td>
                  <td className="px-2.5 py-2 text-zinc-600">{e.eventType}</td>
                  <td className="px-2.5 py-2">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                        e.isTest ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"
                      )}
                    >
                      {e.isTest ? "Test" : "Live"}
                    </span>
                  </td>
                  <td className="px-2.5 py-2">
                    {e.isActive ? (
                      <span className="text-emerald-700">Active</span>
                    ) : (
                      <span className="text-zinc-400">Disabled</span>
                    )}
                  </td>
                  <td className="px-2.5 py-2 text-zinc-500">
                    {e.lastReceivedAt
                      ? new Date(e.lastReceivedAt).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-2.5 py-6 text-center text-zinc-500">
                  No triggers yet. Create one to connect Jobber, Stripe, Zapier, Make, or n8n.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedId && (
        <div className="mt-3 rounded-md border border-zinc-200 bg-white p-3">
          {detailLoading || !endpoint ? (
            <p className="text-[12px] text-zinc-500">
              <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> Loading detail…
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-[14px] font-semibold text-zinc-900">
                    {String(endpoint.name)}
                  </h2>
                  <p className="text-[11px] text-zinc-500">
                    {endpoint.isTest ? "Test" : "Live"} ·{" "}
                    {endpoint.isActive ? "Active" : "Disabled"} ·{" "}
                    {String(endpoint.eventType)} · delay{" "}
                    {String(endpoint.sendDelayMinutes)}m
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-400">
                    URL ends with …{String(endpoint.tokenLastFour)} (rotate to get a new full URL)
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    className="rounded border border-zinc-200 px-2 py-1 text-[11px]"
                    onClick={() =>
                      void patchAction(selectedId, undefined, {
                        isTest: !endpoint.isTest,
                      })
                    }
                  >
                    {endpoint.isTest ? "Promote to live" : "Switch to test"}
                  </button>
                  <button
                    type="button"
                    className="rounded border border-zinc-200 px-2 py-1 text-[11px]"
                    onClick={() =>
                      void patchAction(selectedId, undefined, {
                        isActive: !endpoint.isActive,
                      })
                    }
                  >
                    {endpoint.isActive ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    className="rounded border border-zinc-200 px-2 py-1 text-[11px]"
                    onClick={() => void patchAction(selectedId, "rotate_url")}
                  >
                    Rotate URL
                  </button>
                  <button
                    type="button"
                    className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-700"
                    onClick={() => {
                      if (confirm("Revoke this endpoint permanently?")) {
                        void patchAction(selectedId, "revoke");
                      }
                    }}
                  >
                    Revoke
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase text-zinc-500">
                    Sample payload
                  </p>
                  <pre className="mt-1 max-h-48 overflow-auto rounded border border-zinc-100 bg-zinc-50 p-2 text-[10px] text-zinc-700">
                    {JSON.stringify(sample, null, 2)}
                  </pre>
                  <button
                    type="button"
                    className="mt-1 text-[11px] text-zinc-600 underline"
                    onClick={() => void copy(JSON.stringify(sample, null, 2))}
                  >
                    Copy sample JSON
                  </button>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase text-zinc-500">
                    Zapier / Make / n8n
                  </p>
                  <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-[11px] leading-relaxed text-zinc-600">
                    <li>Trigger: job/invoice/appointment completed</li>
                    <li>Action: HTTP POST (Webhooks by Zapier / Make HTTP / n8n HTTP Request)</li>
                    <li>Paste your unique webhook URL</li>
                    <li>Content-Type: application/json</li>
                    <li>Map event_id, customer name/email/phone</li>
                    <li>Test — confirm event appears below</li>
                    <li>Promote endpoint to live when ready</li>
                  </ol>
                  <p className="mt-2 text-[11px] text-zinc-500">
                    Full docs in the repo: docs/INCOMING_WEBHOOKS.md
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase text-zinc-500">
                  Recent events
                </p>
                <ul className="mt-1 max-h-56 space-y-1 overflow-y-auto text-[11px]">
                  {events.length ? (
                    events.map((ev) => {
                      const norm = (ev.payload_normalized ?? {}) as {
                        customer?: { name?: string; email?: string; phone?: string };
                      };
                      const customer =
                        norm.customer?.name ||
                        norm.customer?.email ||
                        norm.customer?.phone ||
                        "—";
                      return (
                        <li
                          key={String(ev.id)}
                          className="rounded border border-zinc-100 px-2 py-1.5"
                        >
                          <div className="flex justify-between gap-2">
                            <span className="font-medium text-zinc-800">
                              {String(ev.event_type)} · {String(ev.status)}
                            </span>
                            <span className="text-zinc-400">
                              {ev.received_at
                                ? new Date(String(ev.received_at)).toLocaleString()
                                : ""}
                            </span>
                          </div>
                          <p className="text-zinc-600">
                            {customer}
                            {ev.external_event_id
                              ? ` · ${String(ev.external_event_id)}`
                              : ""}
                          </p>
                          {ev.customer_safe_error ? (
                            <p className="text-amber-700">{String(ev.customer_safe_error)}</p>
                          ) : null}
                        </li>
                      );
                    })
                  ) : (
                    <li className="text-zinc-400">No events yet. Send a test POST from Zapier.</li>
                  )}
                </ul>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );

  return embedded ? <div className="space-y-3">{content}</div> : <ModulePage>{content}</ModulePage>;
}
