/**
 * Backend adapter shell for Kimi contacts-segments.
 */
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AudienceSubNav, { AudienceTab } from "@/components/kimi/contacts-segments/components/AudienceSubNav";
import SegmentsList from "@/components/kimi/contacts-segments/components/SegmentsList";
import CreateSegment from "@/components/kimi/contacts-segments/components/CreateSegment";
import SegmentContacts from "@/components/kimi/contacts-segments/components/SegmentContacts";
import SegmentSavedModal from "@/components/kimi/contacts-segments/components/SegmentSavedModal";
import Dashboard from "@/components/kimi/contacts-segments/components/Dashboard";
import type { Contact, Segment } from "@/components/kimi/contacts-segments/mock-data";
import {
  createSegment,
  deleteSegment,
  fetchSegmentContacts,
  fetchSegments,
  previewSegmentCount,
  updateSegment,
} from "@/lib/contacts/kimi-segments-adapter";
import { kimiGroupsToSegmentConditions } from "@/lib/contacts/kimi-segment-condition-map";
import { fetchContactStats } from "@/lib/contacts/kimi-contacts-adapter";
import { fetchLists } from "@/lib/contacts/kimi-lists-adapter";
import { fetchInboxList } from "@/lib/inbox/kimi-inbox-adapter";
import { Send, CheckCircle2, LayoutDashboard } from "lucide-react";

type View =
  | { name: "home" }
  | { name: "audience"; tab: AudienceTab }
  | { name: "create"; editing?: Segment | null }
  | { name: "contacts"; segment: Segment }
  | { name: "campaign"; segment: Segment };

type Props = { initialSegments?: Segment[] };

export function KimiSegmentsConnected({ initialSegments = [] }: Props) {
  const router = useRouter();
  const [view, setView] = useState<View>({ name: "audience", tab: "segments" });
  const [segments, setSegments] = useState<Segment[]>(initialSegments);
  const [segmentContacts, setSegmentContacts] = useState<Contact[]>([]);
  const [listOptions, setListOptions] = useState<string[]>([]);
  const [savedSegment, setSavedSegment] = useState<Segment | null>(null);
  const [campaignSent, setCampaignSent] = useState(false);
  const [error, setError] = useState("");
  const [dashboardStats, setDashboardStats] = useState({
    totalContacts: 0,
    subscribedContacts: 0,
    unreadMessages: 0,
  });

  const reload = useCallback(async () => {
    const rows = await fetchSegments();
    setSegments(rows);
  }, []);

  const loadAudience = useCallback(async () => {
    const apiLists = await fetchLists();
    setListOptions(apiLists.map((l) => l.name));
  }, []);

  useEffect(() => {
    if (initialSegments.length === 0) {
      void reload().catch(() => undefined);
    }
    void loadAudience().catch(() => undefined);
  }, [initialSegments.length, reload, loadAudience]);

  useEffect(() => {
    void Promise.all([
      fetchContactStats().catch(() => ({ contacts: 0, subscribed: 0, unsubscribed: 0 })),
      fetchInboxList({ product: "all", unread: true }).catch(() => []),
    ]).then(([stats, unreadRows]) => {
      setDashboardStats({
        totalContacts: stats.contacts,
        subscribedContacts: stats.subscribed,
        unreadMessages: unreadRows.length,
      });
    });
  }, []);

  useEffect(() => {
    if (view.name !== "contacts") return;
    void fetchSegmentContacts(view.segment.id)
      .then(({ contacts, total }) => {
        setSegmentContacts(
          contacts.map((c) => ({
            id: c.id,
            phone: c.phone,
            firstName: c.firstName,
            lastName: c.lastName,
            email: c.email,
            state: c.state,
            age: c.age,
            status: c.status === "Subscribed" ? "Subscribed" : "Unsubscribed",
          })),
        );
        setSegments((prev) =>
          prev.map((s) => (s.id === view.segment.id ? { ...s, contacts: total } : s)),
        );
      })
      .catch(() => setSegmentContacts([]));
  }, [view]);

  const goTab = (tab: AudienceTab) => {
    if (tab === "contacts") {
      router.push("/contacts");
      return;
    }
    if (tab === "lists") {
      router.push("/contacts/lists");
      return;
    }
    setView({ name: "audience", tab });
  };

  const handleSaved = (seg: Segment, mode: "segments" | "contacts" | "campaign") => {
    void reload();
    if (mode === "contacts") { setView({ name: "contacts", segment: seg }); return; }
    if (mode === "campaign") { setView({ name: "campaign", segment: seg }); return; }
    setSavedSegment(seg);
  };

  const handleDelete = async (id: string) => {
    setError("");
    try {
      await deleteSegment(id);
      setSegments((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete segment");
    }
  };

  const handleSaveSegment = async (input: {
    name: string;
    editing: Segment | null | undefined;
    contactCount: number;
    groups: { conditions: { property: string; condition: string; value: string; values?: string[] }[] }[];
  }) => {
    const conditions = kimiGroupsToSegmentConditions(input.groups);
    if (input.editing?.id) {
      return updateSegment(input.editing.id, input.name, conditions);
    }
    const seg = await createSegment(input.name, conditions);
    return { ...seg, contacts: input.contactCount };
  };

  const handlePreviewCount = useCallback(async (groups: Parameters<typeof kimiGroupsToSegmentConditions>[0]) => {
    const conditions = kimiGroupsToSegmentConditions(groups);
    return previewSegmentCount(conditions);
  }, []);

  return (
    <div className="seg-shell min-h-screen bg-background text-foreground">
      {error && <p className="px-6 pt-4 text-sm text-red-600">{error}</p>}
      <div className="border-b border-border bg-card px-6 flex items-center gap-2">
        <button onClick={() => setView({ name: "home" })}
          className={`flex items-center gap-1.5 px-3 py-2 my-1.5 rounded-lg text-xs font-medium transition-colors ${view.name === "home" ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
          <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
        </button>
      </div>
      <AudienceSubNav active={view.name === "audience" ? view.tab : "segments"} onChange={goTab} />

      {view.name === "home" && (
        <Dashboard onGoSegments={() => setView({ name: "audience", tab: "segments" })} stats={dashboardStats} />
      )}

      {view.name === "audience" && view.tab === "segments" && (
        <SegmentsList
          segments={segments}
          onCreate={() => setView({ name: "create" })}
          onViewContacts={(s) => setView({ name: "contacts", segment: s })}
          onEdit={(s) => setView({ name: "create", editing: s })}
          onDelete={(id) => void handleDelete(id)}
        />
      )}

      {view.name === "create" && (
        <CreateSegment
          editing={view.editing}
          listOptions={listOptions}
          onBack={() => setView({ name: "audience", tab: "segments" })}
          onSaved={handleSaved}
          onViewContacts={(s) => setView({ name: "contacts", segment: s })}
          onCreateCampaign={(s) => setView({ name: "campaign", segment: s })}
          onSaveSegment={handleSaveSegment}
          onSaveError={(msg) => setError(msg)}
          onPreviewCount={handlePreviewCount}
        />
      )}

      {view.name === "contacts" && (
        <SegmentContacts
          segment={view.segment}
          contacts={segmentContacts}
          onBack={() => setView({ name: "audience", tab: "segments" })}
          onEdit={() => setView({ name: "create", editing: view.segment })}
        />
      )}

      {view.name === "campaign" && (
        <div className="p-6 max-w-3xl mx-auto seg-fade">
          <p className="text-xs text-muted-foreground mb-1">Campaigns / Create Campaign</p>
          <h1 className="text-[22px] font-semibold tracking-tight mb-1">Create Campaign</h1>
          <p className="text-sm text-muted-foreground mb-6">Send a message to segment “{view.segment.name}” (<span className="tabular-nums">{view.segment.contacts.toLocaleString()}</span> contacts).</p>
          <div className="seg-card rounded-xl border border-border bg-card p-5 space-y-4">
            <div>
              <label className="text-sm font-medium">Campaign Name</label>
              <input defaultValue={`${view.segment.name} Blast`} className="seg-input mt-1.5 w-full h-10 rounded-lg border border-border bg-card px-3 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium">Message</label>
              <textarea rows={4} defaultValue={`Hey {firstName}! Exclusive offer for our West Coast crew — 20% off this weekend only. Reply STOP to opt out.`}
                className="seg-input mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm" />
              <p className="text-xs text-muted-foreground mt-1.5 tabular-nums">161 characters · 2 credits per contact · ~{(view.segment.contacts * 2).toLocaleString()} credits</p>
            </div>
            {campaignSent ? (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 shrink-0" /> Campaign scheduled to <span className="tabular-nums">{view.segment.contacts.toLocaleString()}</span> contacts.
              </div>
            ) : (
              <div className="flex gap-2 pt-1">
                <button onClick={() => router.push(`/campaigns/new?segmentId=${encodeURIComponent(view.segment.id)}`)} className="seg-btn-primary h-10 px-5 rounded-lg text-sm font-medium flex items-center gap-2"><Send className="h-4 w-4" /> Create Campaign</button>
                <button onClick={() => setView({ name: "audience", tab: "segments" })} className="h-10 px-5 rounded-lg border border-border bg-card hover:bg-muted text-sm font-medium transition-colors">Back</button>
              </div>
            )}
          </div>
        </div>
      )}

      {savedSegment && (
        <SegmentSavedModal
          segment={savedSegment}
          onViewSegments={() => { setSavedSegment(null); setView({ name: "audience", tab: "segments" }); }}
          onViewContacts={() => { const s = savedSegment; setSavedSegment(null); setView({ name: "contacts", segment: s }); }}
          onCreateCampaign={() => { const s = savedSegment; setSavedSegment(null); setView({ name: "campaign", segment: s }); }}
        />
      )}
    </div>
  );
}
