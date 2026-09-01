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
      <div className="border-b border-border bg-card px-6 h-12 flex items-center gap-2">
        <button
          onClick={() => setView({ name: "home" })}
          className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12.5px] font-medium transition-all duration-150 ${
            view.name === "home"
              ? "bg-primary/10 text-primary ring-1 ring-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
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
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
            <span>Campaigns</span>
            <span className="text-border">/</span>
            <span className="text-foreground font-medium">Create Campaign</span>
          </nav>
          <h1 className="font-display text-[22px] font-semibold tracking-tight mb-1">Create Campaign</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Send a message to segment <span className="font-medium text-foreground">“{view.segment.name}”</span>{" "}
            (<span className="tabular-nums">{view.segment.contacts.toLocaleString()}</span> contacts).
          </p>
          <div className="seg-card rounded-xl border border-border bg-card p-6 space-y-5">
            <div>
              <label className="block text-[13px] font-medium text-foreground">Campaign Name</label>
              <input
                defaultValue={`${view.segment.name} Blast`}
                className="seg-input mt-1.5 w-full h-10 rounded-lg border border-border bg-card px-3 text-sm transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30 outline-none"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-foreground">Message</label>
              <textarea
                rows={4}
                defaultValue={`Hey {firstName}! Exclusive offer for our West Coast crew — 20% off this weekend only. Reply STOP to opt out.`}
                className="seg-input mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm leading-relaxed transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30 outline-none resize-y"
              />
              <p className="text-xs text-muted-foreground mt-1.5 tabular-nums">
                161 characters · 2 credits per contact · ~{(view.segment.contacts * 2).toLocaleString()} credits
              </p>
            </div>
            {campaignSent ? (
              <div className="flex items-center gap-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Campaign scheduled to <span className="tabular-nums">{view.segment.contacts.toLocaleString()}</span> contacts.
              </div>
            ) : (
              <div className="flex gap-2.5 pt-1">
                <button
                  onClick={() => setCampaignSent(true)}
                  className="seg-btn-primary h-10 px-5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-150 active:scale-[0.98]"
                >
                  <Send className="h-4 w-4" /> Schedule Campaign
                </button>
                <button
                  onClick={() => setView({ name: "audience", tab: "segments" })}
                  className="h-10 px-5 rounded-lg border border-border bg-card hover:bg-muted/70 text-sm font-medium text-foreground transition-colors"
                >
                  Back
                </button>
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
