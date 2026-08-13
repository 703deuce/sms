"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

type BrainFact = { label: string; summary: string; status?: string };
type Brain = {
  businessName?: string;
  website?: string;
  defaultTimezone?: string;
  knowledgeFacts?: BrainFact[];
  businessHoursSummary?: string | null;
};

type Method = "website" | "conversation" | "manual";

function statusLabel(status?: string) {
  const s = String(status || "extracted").toLowerCase();
  if (s === "owner_approved" || s === "complete" || s === "confirmed") return "Confirmed";
  if (s === "rejected") return "Rejected";
  if (s === "edited") return "Edited";
  if (s === "unresolved") return "Not confirmed";
  return "Review";
}

export function CompanyBrainSetup() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams?.get("next") || "amy";
  const [method, setMethod] = useState<Method>("website");
  const [brain, setBrain] = useState<Brain | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [conversation, setConversation] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualHours, setManualHours] = useState("");
  const [manualServices, setManualServices] = useState("");
  const [manualLocation, setManualLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanNote, setScanNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/company-brain", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (res.ok) setBrain(json.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const continueHref =
    next === "tom"
      ? "/solutions/missed-call-text-back/setup?hire=tom"
      : "/solutions/ai-call-handling/appointment-assistant/setup?hire=amy";

  async function scanWebsite() {
    setBusy(true);
    setError(null);
    setScanNote(null);
    try {
      const url = websiteUrl.trim();
      if (!url) throw new Error("Enter a website URL");
      const res = await fetch("/api/voice/knowledge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "scan_website", url }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Website scan failed");

      const items = (json.data?.items || json.data?.knowledgeItems || []) as Array<{
        label?: string;
        summary?: string;
        status?: string;
      }>;
      const facts = items
        .map((i) => ({
          label: String(i.label || "").trim(),
          summary: String(i.summary || "").trim(),
          status: i.status || "extracted",
        }))
        .filter((f) => f.label && f.summary);

      if (!facts.length) {
        // Fallback: store URL + note for owner to fill conversationally
        await fetch("/api/company-brain", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "upsert_facts",
            websiteUrl: url,
            facts: [
              {
                label: "Website",
                summary: url,
                status: "extracted",
              },
              {
                label: "Business description",
                summary: "Imported from website — review details before trusting in production",
                status: "extracted",
              },
            ],
          }),
        });
        setScanNote(
          "Website linked. Extracted facts need your review before they become trusted company knowledge.",
        );
      } else {
        await fetch("/api/company-brain", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "upsert_facts",
            websiteUrl: url,
            facts,
          }),
        });
        setScanNote(
          `${facts.length} fact(s) extracted. None are trusted until you confirm them.`,
        );
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function extractConversation() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/company-brain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "extract_from_text",
          brain: { conversationText: conversation },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not extract facts");
      setBrain(json.data.brain);
      setScanNote("Facts extracted from your description — review and confirm below.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveManual() {
    setBusy(true);
    setError(null);
    try {
      const facts: BrainFact[] = [];
      if (manualName.trim()) {
        facts.push({
          label: "Business name",
          summary: manualName.trim(),
          status: "owner_approved",
        });
      }
      if (manualLocation.trim()) {
        facts.push({
          label: "Main location",
          summary: manualLocation.trim(),
          status: "owner_approved",
        });
      }
      if (manualHours.trim()) {
        facts.push({
          label: "Business hours",
          summary: manualHours.trim(),
          status: "owner_approved",
        });
      }
      if (manualServices.trim()) {
        facts.push({
          label: "Services",
          summary: manualServices.trim(),
          status: "owner_approved",
        });
      }
      const res = await fetch("/api/company-brain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "save",
          brain: {
            businessName: manualName.trim() || undefined,
            businessHoursSummary: manualHours.trim() || undefined,
            knowledgeFacts: facts,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Save failed");
      setBrain(json.data);
      setScanNote("Manual company profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function approveAll() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/company-brain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "approve_facts", facts: [] }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Approve failed");
      setBrain(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const facts = brain?.knowledgeFacts || [];

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <header className="space-y-2">
        <Link href="/hire" className="text-sm font-medium text-indigo-600">
          ← Back to team
        </Link>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900">
          Tell your team about your business
        </h1>
        <p className="text-sm text-slate-600">
          This builds your <strong>Company Brain</strong> — shared knowledge for Amy, Tom, and
          future agents. Extracted facts stay untrusted until you confirm them.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["website", "Import my website"],
            ["conversation", "Tell me in conversation"],
            ["manual", "Enter manually"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMethod(id)}
            className={cn(
              "min-h-10 rounded-lg border px-3 py-2 text-[12px] font-semibold",
              method === id
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 text-slate-700",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {method === "website" ? (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-800">
              Website URL
              <input
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://yoursite.com"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void scanWebsite()}
              className="min-h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Importing…" : "Import & extract"}
            </button>
          </div>
        ) : null}

        {method === "conversation" ? (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-800">
              Describe your business
              <textarea
                className="mt-1.5 min-h-32 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={conversation}
                onChange={(e) => setConversation(e.target.value)}
                placeholder="We’re a plumbing company in Fredericksburg. We’re open Monday through Friday from 8 to 5. We do drain cleaning, water heaters, and emergency plumbing."
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void extractConversation()}
              className="min-h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Extracting…" : "Extract facts for review"}
            </button>
          </div>
        ) : null}

        {method === "manual" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-800 sm:col-span-2">
              Business name
              <input
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
              />
            </label>
            <label className="block text-sm font-medium text-slate-800">
              Main location
              <input
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                value={manualLocation}
                onChange={(e) => setManualLocation(e.target.value)}
              />
            </label>
            <label className="block text-sm font-medium text-slate-800">
              Business hours
              <input
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                value={manualHours}
                onChange={(e) => setManualHours(e.target.value)}
                placeholder="Mon–Fri 8–5"
              />
            </label>
            <label className="block text-sm font-medium text-slate-800 sm:col-span-2">
              Services
              <input
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                value={manualServices}
                onChange={(e) => setManualServices(e.target.value)}
                placeholder="Drain cleaning, water heaters,…"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveManual()}
              className="min-h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2"
            >
              Save company profile
            </button>
          </div>
        ) : null}

        {scanNote ? <p className="mt-3 text-sm text-violet-700">{scanNote}</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Company knowledge shared with your agents
            </h2>
            <p className="mt-1 text-[12px] text-slate-500">
              {brain?.businessName || "Your company"} · source statuses below
            </p>
          </div>
          <button
            type="button"
            disabled={busy || facts.length === 0}
            onClick={() => void approveAll()}
            className="min-h-10 rounded-lg border border-slate-200 px-3 text-[12px] font-semibold text-slate-700 disabled:opacity-50"
          >
            Confirm all for review
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {facts.length === 0 ? (
            <p className="text-sm text-slate-500">
              No facts yet — import a website, describe the business, or enter details manually.
            </p>
          ) : (
            facts.map((f) => (
              <div
                key={`${f.label}-${f.summary.slice(0, 24)}`}
                className="flex flex-col gap-1 rounded-xl border border-slate-100 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{f.label}</p>
                  <p className="mt-0.5 text-[12px] text-slate-600">{f.summary}</p>
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {statusLabel(f.status)}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-slate-500">
          You can refine this later under Company Brain.
        </p>
        <button
          type="button"
          onClick={() => router.push(continueHref)}
          className="min-h-10 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white"
        >
          Continue to train {next === "tom" ? "Tom" : "Amy"}
        </button>
      </div>
    </div>
  );
}
