/**
 * Kimi session 2026-08-31T05-06-08-206Z-bb0f8d — UI from Kimi draft (mock data, no backend wiring yet).
 */
"use client";
import { useState } from "react";
import AudienceSubNav, { AudienceTab } from "./components/AudienceSubNav";
import SegmentsList from "./components/SegmentsList";
import CreateSegment from "./components/CreateSegment";
import SegmentContacts from "./components/SegmentContacts";
import SegmentSavedModal from "./components/SegmentSavedModal";
import ContactsList from "./components/ContactsList";
import ListsList from "./components/ListsList";
import Dashboard from "./components/Dashboard";
import { Segment } from "./mock-data";
import { Send, CheckCircle2, LayoutDashboard } from "lucide-react";

type View =
  | { name: "home" }
  | { name: "audience"; tab: AudienceTab }
  | { name: "create"; editing?: Segment | null }
  | { name: "contacts"; segment: Segment }
  | { name: "campaign"; segment: Segment };

export default function ContactsSegmentsFlow() {
  const [view, setView] = useState<View>({ name: "audience", tab: "segments" });
  const [savedSegment, setSavedSegment] = useState<Segment | null>(null);
  const [campaignSent, setCampaignSent] = useState(false);

  const goTab = (tab: AudienceTab) => setView({ name: "audience", tab });

  const handleSaved = (seg: Segment, mode: "segments" | "contacts" | "campaign") => {
    if (mode === "contacts") { setView({ name: "contacts", segment: seg }); return; }
    if (mode === "campaign") { setView({ name: "campaign", segment: seg }); return; }
    setSavedSegment(seg);
  };

  return (
    <div className="seg-shell min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card px-6 flex items-center gap-2">
        <button onClick={() => setView({ name: "home" })}
          className={`flex items-center gap-1.5 px-3 py-2 my-1.5 rounded-md text-xs font-medium transition-colors ${view.name === "home" ? "bg-indigo-50 text-indigo-700" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
          <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
        </button>
      </div>
      <AudienceSubNav active={view.name === "audience" ? view.tab : "segments"} onChange={goTab} />

      {view.name === "home" && <Dashboard onGoSegments={() => setView({ name: "audience", tab: "segments" })} />}

      {view.name === "audience" && view.tab === "segments" && (
        <SegmentsList
          onCreate={() => setView({ name: "create" })}
          onViewContacts={(s) => setView({ name: "contacts", segment: s })}
          onEdit={(s) => setView({ name: "create", editing: s })}
        />
      )}
      {view.name === "audience" && view.tab === "contacts" && <ContactsList />}
      {view.name === "audience" && view.tab === "lists" && <ListsList />}

      {view.name === "create" && (
        <CreateSegment
          editing={view.editing}
          onBack={() => setView({ name: "audience", tab: "segments" })}
          onSaved={handleSaved}
          onViewContacts={(s) => setView({ name: "contacts", segment: s })}
          onCreateCampaign={(s) => setView({ name: "campaign", segment: s })}
        />
      )}

      {view.name === "contacts" && (
        <SegmentContacts
          segment={view.segment}
          onBack={() => setView({ name: "audience", tab: "segments" })}
          onEdit={() => setView({ name: "create", editing: view.segment })}
        />
      )}

      {view.name === "campaign" && (
        <div className="p-6 max-w-3xl mx-auto seg-fade">
          <p className="text-xs text-muted-foreground mb-1">Campaigns / Create Campaign</p>
          <h1 className="text-2xl font-semibold mb-1">Create Campaign</h1>
          <p className="text-sm text-muted-foreground mb-6">Send a message to segment “{view.segment.name}” ({view.segment.contacts.toLocaleString()} contacts).</p>
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <div>
              <label className="text-sm font-medium">Campaign Name</label>
              <input defaultValue={`${view.segment.name} Blast`} className="mt-1.5 w-full h-10 rounded-md border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="text-sm font-medium">Message</label>
              <textarea rows={4} defaultValue={`Hey {firstName}! Exclusive offer for our West Coast crew — 20% off this weekend only. Reply STOP to opt out.`}
                className="mt-1.5 w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <p className="text-xs text-muted-foreground mt-1">161 characters · 2 credits per contact · ~{(view.segment.contacts * 2).toLocaleString()} credits</p>
            </div>
            {campaignSent ? (
              <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" /> Campaign scheduled to {view.segment.contacts.toLocaleString()} contacts.
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setCampaignSent(true)} className="h-10 px-5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium flex items-center gap-2"><Send className="h-4 w-4" /> Schedule Campaign</button>
                <button onClick={() => setView({ name: "audience", tab: "segments" })} className="h-10 px-5 rounded-md border border-border bg-card hover:bg-muted text-sm font-medium">Back</button>
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
