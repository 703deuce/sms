"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  CheckCircle2,
  Download,
  History,
  Megaphone,
  MoreHorizontal,
  Plus,
  Send,
  Settings,
  Upload,
  Users,
} from "lucide-react";
import { RepBadge, RepMetricCard, RepPageHeader, RepSearch, RepTabs, RepViewLink, rep } from "@/components/reputation/rep-ui";
import { ReviewCampaignsUpgrade } from "@/components/reputation/review-campaigns-upgrade";
import { ContactsImportWizard } from "@/components/reputation/contacts-import-wizard";
import type { ReputationContactPreviewKpis } from "@/lib/reputation/reputation-page-preview-data";
import { cn } from "@/lib/utils";

type ContactTab =
  | "all"
  | "eligible"
  | "requested"
  | "detected"
  | "opted_out"
  | "import_history";

const CONTACT_TABS: Array<{ id: ContactTab; label: string }> = [
  { id: "all", label: "All Contacts" },
  { id: "eligible", label: "Eligible" },
  { id: "requested", label: "Requested" },
  { id: "detected", label: "Review Received" },
  { id: "opted_out", label: "Opted Out" },
  { id: "import_history", label: "Import History" },
];

type ContactRow = {
  id: string;
  customer_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone_e164: string | null;
  email_normalized: string | null;
  sms_opt_out: boolean;
  email_unsubscribed: boolean;
  tags: string[];
  source?: string | null;
  last_contacted_at?: string | null;
  campaign_attempts?: number | null;
  latest_reply_at?: string | null;
  review_completion?: unknown;
  created_at?: string;
  updated_at: string;
  last_service_at?: string | null;
  campaign_status?: string;
};

function tagsInclude(contact: ContactRow, terms: string[]) {
  const tags = (contact.tags ?? []).map((tag) => tag.toLowerCase());
  return terms.some((term) => tags.includes(term));
}

function isEligibleForRequest(contact: ContactRow) {
  return (
    (!contact.sms_opt_out && Boolean(contact.phone_e164)) ||
    (!contact.email_unsubscribed && Boolean(contact.email_normalized))
  );
}

function hasReviewRequestSignal(contact: ContactRow) {
  return (
    Boolean(contact.last_contacted_at) ||
    Number(contact.campaign_attempts ?? 0) > 0 ||
    tagsInclude(contact, ["review_requested", "request_sent", "campaign_requested"])
  );
}

function hasReviewDetectedSignal(contact: ContactRow) {
  return Boolean(contact.review_completion) || tagsInclude(contact, ["review_detected", "reviewed"]);
}

function hasImportSignal(contact: ContactRow) {
  const source = contact.source?.toLowerCase() ?? "";
  return (
    source.includes("csv") ||
    source.includes("import") ||
    tagsInclude(contact, ["imported", "csv_import"])
  );
}

function contactStatus(contact: ContactRow) {
  if (contact.sms_opt_out && contact.email_unsubscribed) return "Opted Out";
  if (contact.sms_opt_out) return "SMS Opted Out";
  if (contact.email_unsubscribed) return "Email Unsub";
  if (hasReviewDetectedSignal(contact)) return "Review Received";
  if (hasReviewRequestSignal(contact)) return "Requested";
  if (isEligibleForRequest(contact)) return "Eligible";
  return "Active";
}

function contactName(contact: ContactRow) {
  return (
    contact.customer_name ||
    [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
    "Unknown contact"
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtPhone(phone: string | null | undefined) {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function reviewStatusTone(contact: ContactRow): "green" | "blue" | "amber" | "gray" | "red" {
  if (contact.sms_opt_out || contact.email_unsubscribed) return "red";
  if (hasReviewDetectedSignal(contact)) return "green";
  if (hasReviewRequestSignal(contact)) return "blue";
  if (isEligibleForRequest(contact)) return "amber";
  return "gray";
}

function tagTone(tag: string): "green" | "blue" | "amber" | "gray" | "purple" | "red" {
  const t = tag.toLowerCase();
  if (t === "vip") return "purple";
  if (t === "reviewed" || t === "google") return "green";
  if (t === "opted_out") return "red";
  if (t === "eligible" || t === "repeat") return "blue";
  return "gray";
}

export function ContactsPageClient({
  businessId,
  allowed,
  initialContacts,
  previewStats,
  previewTotalCount,
}: {
  businessId: string;
  allowed: boolean;
  initialContacts?: ContactRow[];
  previewStats?: ReputationContactPreviewKpis;
  previewTotalCount?: number;
}) {
  const [items, setItems] = useState<ContactRow[]>(initialContacts ?? []);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [loading, setLoading] = useState(!initialContacts);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ContactTab>("all");

  const load = useCallback(
    async (opts?: { reset?: boolean; cursor?: string | null }) => {
      if (!allowed) return;
      if (initialContacts) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ businessId, limit: "50" });
        if (q.trim()) params.set("q", q.trim());
        const pageCursor = opts?.reset ? null : (opts?.cursor ?? cursor);
        if (pageCursor) params.set("cursor", pageCursor);
        const res = await fetch(`/api/reputation/contacts?${params}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load");
        setItems((prev) =>
          opts?.reset || !pageCursor ? json.items ?? [] : [...prev, ...(json.items ?? [])]
        );
        setNextCursor(json.nextCursor ?? null);
        if (pageCursor) setCursor(pageCursor);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    },
    [allowed, businessId, cursor, initialContacts, q]
  );

  useEffect(() => {
    if (initialContacts) return;
    queueMicrotask(() => void load({ reset: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- search on mount / allowed
  }, [allowed, businessId, initialContacts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("import") === "1") queueMicrotask(() => setShowImport(true));
  }, []);

  const visibleItems = useMemo(() => {
    const tabItems = (() => {
      switch (activeTab) {
        case "eligible":
          return items.filter(isEligibleForRequest);
        case "requested":
          return items.filter(hasReviewRequestSignal);
        case "detected":
          return items.filter(hasReviewDetectedSignal);
        case "opted_out":
          return items.filter((c) => c.sms_opt_out || c.email_unsubscribed);
        case "import_history":
          return items.filter(hasImportSignal);
        case "all":
        default:
          return items;
      }
    })();
    const needle = q.trim().toLowerCase();
    const sourceFiltered =
      sourceFilter === "all"
        ? tabItems
        : tabItems.filter((c) => (c.source?.toLowerCase() ?? "").includes(sourceFilter));
    const campaignFiltered =
      campaignFilter === "all"
        ? sourceFiltered
        : campaignFilter === "requested"
          ? sourceFiltered.filter(hasReviewRequestSignal)
          : sourceFiltered.filter((c) => !hasReviewRequestSignal(c));
    if (!needle) return campaignFiltered;
    return campaignFiltered.filter((contact) =>
      [
        contactName(contact),
        contact.email_normalized ?? "",
        contact.phone_e164 ?? "",
        contact.source ?? "",
        ...(contact.tags ?? []),
      ].some((value) => value.toLowerCase().includes(needle))
    );
  }, [activeTab, campaignFilter, items, q, sourceFilter]);

  const emptyMessage = useMemo(() => {
    if (activeTab === "eligible") return "No eligible contacts in the loaded results.";
    if (activeTab === "requested") return "No loaded contacts show review-request history.";
    if (activeTab === "detected") return "No loaded contacts show detected review completion.";
    if (activeTab === "opted_out") return "No loaded contacts are opted out or unsubscribed.";
    if (activeTab === "import_history") return "No import-sourced contacts found in the loaded results.";
    return "No contacts yet. Add a customer or import via a campaign.";
  }, [activeTab]);

  const contactStats = useMemo(() => {
    if (previewStats) return previewStats;
    return {
      all: items.length,
      eligible: items.filter(isEligibleForRequest).length,
      requested: items.filter(hasReviewRequestSignal).length,
      received: items.filter(hasReviewDetectedSignal).length,
      optedOut: items.filter((contact) => contact.sms_opt_out || contact.email_unsubscribed).length,
    };
  }, [items, previewStats]);

  const totalCount = previewTotalCount ?? items.length;

  if (!allowed) {
    return <ReviewCampaignsUpgrade businessId={businessId} />;
  }

  async function saveContact() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/reputation/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          firstName,
          lastName,
          phone,
          email,
          consentState: "express",
          consentSource: "manual_entry",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setShowAdd(false);
      setFirstName("");
      setLastName("");
      setPhone("");
      setEmail("");
      setCursor(null);
      await load({ reset: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const eligiblePct = totalCount > 0 ? Math.round((contactStats.eligible / totalCount) * 100) : 0;
  const requestedPct = totalCount > 0 ? Math.round((contactStats.requested / totalCount) * 100) : 0;
  const receivedPct = totalCount > 0 ? Math.round((contactStats.received / totalCount) * 100) : 0;
  const optedOutPct = totalCount > 0 ? Math.round((contactStats.optedOut / totalCount) * 100) : 0;

  return (
    <div className={rep.page}>
      <RepPageHeader
        title="Contacts"
        subtitle="Manage your customers and their review request status."
        showCompare={false}
        showExport={false}
        showFilters={false}
        actions={
          <>
            <button type="button" onClick={() => setShowAdd((value) => !value)} className={rep.btnPrimary}>
              <Plus className="h-4 w-4" />
              Add Contact
            </button>
            <button type="button" onClick={() => setShowImport((value) => !value)} className={rep.btnSecondary}>
              <Upload className="h-4 w-4" />
              Import
            </button>
            <button type="button" className={rep.btnSecondary}>
              <Download className="h-4 w-4" />
              Export
            </button>
            <button type="button" onClick={() => setActiveTab("import_history")} className={rep.btnSecondary}>
              <History className="h-4 w-4" />
              Import History
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <RepMetricCard label="All Contacts" value={totalCount.toLocaleString()} icon={Users}>
          <RepViewLink href={`/businesses/${businessId}/reputation/contacts`}>View →</RepViewLink>
        </RepMetricCard>
        <RepMetricCard label="Eligible" value={contactStats.eligible.toLocaleString()} icon={CheckCircle2} hint={`${eligiblePct}% of total`}>
          <button type="button" onClick={() => setActiveTab("eligible")} className={rep.link}>View →</button>
        </RepMetricCard>
        <RepMetricCard label="Requested" value={contactStats.requested.toLocaleString()} icon={Send} hint={`${requestedPct}% of total`}>
          <button type="button" onClick={() => setActiveTab("requested")} className={rep.link}>View →</button>
        </RepMetricCard>
        <RepMetricCard label="Review Received" value={contactStats.received.toLocaleString()} icon={CheckCircle2} hint={`${receivedPct}% of total`}>
          <button type="button" onClick={() => setActiveTab("detected")} className={rep.link}>View →</button>
        </RepMetricCard>
        <RepMetricCard label="Opted Out" value={contactStats.optedOut.toLocaleString()} icon={Ban} iconClassName="bg-[#FEF3F2] text-[#B42318]" hint={`${optedOutPct}% of total`}>
          <button type="button" onClick={() => setActiveTab("opted_out")} className={rep.link}>View →</button>
        </RepMetricCard>
      </div>

      {showImport ? (
        <div className={cn(rep.card, "p-4")}>
          <ContactsImportWizard
            businessId={businessId}
            onDone={() => {
              setCursor(null);
              void load({ reset: true });
            }}
          />
        </div>
      ) : null}

      {showAdd ? (
        <div className={cn(rep.card, "grid gap-3 p-4 md:grid-cols-4")}>
          <input className={rep.input} placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <input className={rep.input} placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          <input className={rep.input} placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input className={rep.input} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button type="button" disabled={saving} onClick={() => void saveContact()} className={cn(rep.btnPrimary, "md:col-span-4 md:w-fit disabled:opacity-60")}>
            {saving ? "Saving..." : "Save contact"}
          </button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-[#B42318]">{error}</p> : null}

      <RepTabs tabs={CONTACT_TABS} active={activeTab} onChange={(id) => setActiveTab(id as ContactTab)} />

      <div className={cn(rep.card, "flex flex-col gap-3 p-3 lg:flex-row lg:items-center")}>
        <RepSearch value={q} onChange={setQ} placeholder="Search name, email, phone, source, or tag..." />
        <div className="flex flex-wrap gap-2">
          <select className={rep.select} value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="all">All sources</option>
            <option value="csv">CSV import</option>
            <option value="manual">Manual</option>
            <option value="housecall">Housecall Pro</option>
            <option value="webhook">Webhook</option>
          </select>
          <select className={rep.select} value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)}>
            <option value="all">All campaigns</option>
            <option value="requested">Requested</option>
            <option value="not-requested">Not requested</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setCursor(null);
              void load({ reset: true });
            }}
            className={rep.btnSecondary}
          >
            Search
          </button>
        </div>
      </div>

      <div className={cn(rep.card, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#E6EAF0] bg-[#F9FAFB] text-[11px] uppercase tracking-[0.06em] text-[#667085]">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" className="h-4 w-4 rounded border-[#D0D5DD]" aria-label="Select all contacts" />
                </th>
                <th className="min-w-[200px] px-4 py-3 font-semibold">Contact</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Campaign Status</th>
                <th className="px-4 py-3 font-semibold">Review Status</th>
                <th className="px-4 py-3 font-semibold">Tags</th>
                <th className="px-4 py-3 font-semibold">Last Service</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F6]">
              {visibleItems.map((contact) => {
                const name = contactName(contact);
                const suppressed = contact.sms_opt_out || contact.email_unsubscribed;
                const status = contactStatus(contact);
                const tone = reviewStatusTone(contact);
                return (
                  <tr key={contact.id} className="bg-white hover:bg-[#F9FAFB]">
                    <td className="px-4 py-3">
                      <input type="checkbox" className="h-4 w-4 rounded border-[#D0D5DD]" aria-label={`Select ${name}`} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ECFDF3] text-xs font-bold text-[#137752]">
                          {initials(name)}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-[#101828]">{name}</p>
                          <p className="text-xs text-[#667085]">{contact.source ?? "Manual"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[#344054]">{fmtPhone(contact.phone_e164)}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-[#344054]">
                        {contact.campaign_status ??
                          (hasReviewRequestSignal(contact)
                            ? `${contact.campaign_attempts ?? 1} attempt${Number(contact.campaign_attempts ?? 1) !== 1 ? "s" : ""}`
                            : "Not enrolled")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <RepBadge tone={tone}>{status}</RepBadge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-[180px] flex-wrap gap-1">
                        {(contact.tags ?? []).slice(0, 3).map((tag) => (
                          <RepBadge key={tag} tone={tagTone(tag)}>{tag}</RepBadge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#667085]">
                      {fmtDate(contact.last_service_at ?? contact.updated_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="text-xs font-semibold text-[#137752] hover:underline"
                          onClick={() => {
                            void (async () => {
                              const res = await fetch("/api/reputation/contacts", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  businessId,
                                  contactId: contact.id,
                                  action: suppressed ? "unsuppress" : "suppress",
                                  channel: "both",
                                }),
                              });
                              if (res.ok) {
                                setCursor(null);
                                await load({ reset: true });
                              }
                            })();
                          }}
                        >
                          {suppressed ? "Clear" : "Suppress"}
                        </button>
                        <button type="button" className="rounded-lg p-1.5 text-[#98A2B3] hover:bg-[#F2F4F7]">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && visibleItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#667085]">
                    {emptyMessage}
                  </td>
                </tr>
              ) : null}
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#667085]">
                    Loading contacts...
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-[#E6EAF0] px-4 py-3 text-sm text-[#667085]">
          <span>
            Showing {visibleItems.length > 0 ? 1 : 0} to {visibleItems.length} of {totalCount.toLocaleString()} contacts
          </span>
          {nextCursor ? (
            <button type="button" className={rep.link} onClick={() => void load({ cursor: nextCursor })}>
              Load more →
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          { title: "Import customers", body: "Upload a CSV and map fields safely.", icon: Upload, href: `/businesses/${businessId}/reputation/contacts?import=1` },
          { title: "Send requests", body: "Start a one-time review request flow.", icon: Send, href: `/businesses/${businessId}/reputation/requests` },
          { title: "Campaigns", body: "Enroll eligible contacts into automations.", icon: Megaphone, href: `/businesses/${businessId}/reputation/campaigns` },
          { title: "Consent settings", body: "Manage opt-out and quiet-hour rules.", icon: Settings, href: `/businesses/${businessId}/reputation/settings` },
        ].map((card) => (
          <Link key={card.title} href={card.href} className={cn(rep.card, "block p-4 transition hover:-translate-y-0.5 hover:shadow-md")}>
            <card.icon className="h-5 w-5 text-[#137752]" />
            <h3 className="mt-3 text-sm font-semibold text-[#101828]">{card.title}</h3>
            <p className="mt-1 text-sm text-[#667085]">{card.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
