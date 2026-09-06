"use client";
import { useState, useEffect } from "react";
import "./reference.css";
import AudienceSubNav, { AudienceTab } from "./components/AudienceSubNav";
import Dashboard from "./components/Dashboard";
import SegmentsList from "./components/SegmentsList";
import CreateSegment from "./components/CreateSegment";
import SegmentContacts from "./components/SegmentContacts";
import SegmentSavedModal from "./components/SegmentSavedModal";
import { initialSegments, listOptions, type Segment } from "./mock-data";
import { LayoutDashboard } from "lucide-react";

type View =
  | { name: "home" }
  | { name: "audience"; tab: AudienceTab }
  | { name: "create"; editing?: Segment | null }
  | { name: "contacts"; segment: Segment };

export default function ReferencePage() {
  const [view, setView] = useState<View>({ name: "audience", tab: "segments" });
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [savedSegment, setSavedSegment] = useState<Segment | null>(null);
  const [error, setError] = useState("");

  // Simulated initial fetch (backend contract: GET /api/contacts/segments)
  const load = () => {
    setLoading(true);
    setLoadError("");
    const t = setTimeout(() => {
      setSegments(initialSegments);
      setLoading(false);
    }, 500);
    return () => clearTimeout(t);
  };

  useEffect(load, []);

  const goTab = (tab: AudienceTab) => {
    // Contacts and Lists are peer surfaces; in the sandbox only Segments is in scope.
    setView({ name: "audience", tab });
  };

  const handleSaved = (seg: Segment, mode: "segments" | "contacts") => {
    setSegments((prev) => {
      const exists = prev.some((s) => s.id === seg.id);
      return exists ? prev.map((s) => (s.id === seg.id ? seg : s)) : [seg, ...prev];
    });
    if (mode === "contacts") {
      setView({ name: "contacts", segment: seg });
      return;
    }
    setSavedSegment(seg);
  };

  const handleDelete = (id: string) => {
    setError("");
    try {
      setSegments((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete segment");
    }
  };

  return (
    <div className="kimi-surface kimi-contacts-segments seg-shell min-h-screen bg-background text-foreground">
      {error && (
        <p role="alert" className="px-6 pt-4 text-sm text-red-600">{error}</p>
      )}

      <div className="border-b border-border bg-card px-6 flex items-center gap-2">
        <button
          onClick={() => setView({ name: "home" })}
          className={`flex items-center gap-1.5 px-3 py-2 my-1.5 rounded-lg text-xs font-medium transition-colors ${
            view.name === "home"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
          }`}
        >
          <LayoutDashboard className="h-3.5 w-3.5" /> Audience Overview
        </button>
      </div>

      {(view.name === "audience" || view.name === "create" || view.name === "contacts") && (
        <AudienceSubNav active={view.name === "audience" ? view.tab : "segments"} onChange={goTab} />
      )}

      {view.name === "home" && (
        <Dashboard
          onGoSegments={() => setView({ name: "audience", tab: "segments" })}
          onGoLists={() => setView({ name: "audience", tab: "lists" })}
        />
      )}

      {view.name === "audience" && view.tab === "segments" && (
        <SegmentsList
          segments={segments}
          loading={loading}
          error={loadError}
          onRetry={load}
          onCreate={() => setView({ name: "create", editing: null })}
          onEdit={(s) => setView({ name: "create", editing: s })}
          onViewContacts={(s) => setView({ name: "contacts", segment: s })}
          onDelete={handleDelete}
        />
      )}

      {view.name === "audience" && view.tab !== "segments" && (
        <div className="p-6 max-w-6xl mx-auto seg-fade">
          <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground capitalize">{view.tab}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {view.tab === "contacts"
              ? "The Contacts surface is a separate page in the app shell (/contacts)."
              : "The Lists surface is a separate page in the app shell (/contacts/lists)."}
          </p>
          <button
            onClick={() => setView({ name: "audience", tab: "segments" })}
            className="mt-4 h-9 px-4 rounded-lg border border-border bg-card hover:bg-muted/70 text-sm font-medium transition-colors"
          >
            Back to Segments
          </button>
        </div>
      )}

      {view.name === "create" && (
        <CreateSegment
          editing={view.editing}
          listOptions={listOptions}
          onBack={() => setView({ name: "audience", tab: "segments" })}
          onSaved={handleSaved}
        />
      )}

      {view.name === "contacts" && (
        <SegmentContacts
          segment={view.segment}
          onBack={() => setView({ name: "audience", tab: "segments" })}
          onEdit={() => setView({ name: "create", editing: view.segment })}
        />
      )}

      {savedSegment && (
        <SegmentSavedModal
          segment={savedSegment}
          onViewContacts={() => {
            setView({ name: "contacts", segment: savedSegment });
            setSavedSegment(null);
          }}
          onViewSegments={() => {
            setView({ name: "audience", tab: "segments" });
            setSavedSegment(null);
          }}
        />
      )}
    </div>
  );
}
