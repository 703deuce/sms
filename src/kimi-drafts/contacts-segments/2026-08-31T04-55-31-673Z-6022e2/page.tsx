"use client";

import { useState } from "react";
import "./reference.css";
import SegmentsList from "./components/SegmentsList";
import CreateSegment from "./components/CreateSegment";
import SegmentContacts from "./components/SegmentContacts";
import CreateCampaign from "./components/CreateCampaign";
import SuccessScreen from "./components/SuccessScreen";
import { Segment } from "./mock-data";

export type View =
  | { name: "list" }
  | { name: "create" }
  | { name: "edit"; segment: Segment }
  | { name: "contacts"; segment: Segment }
  | { name: "campaign"; segment: Segment }
  | { name: "success"; segment: Segment; destination: "contacts" | "segments" | "campaign" };

export default function ReferencePage() {
  const [view, setView] = useState<View>({ name: "list" });

  return (
    <div className="seg-shell min-h-screen bg-background text-foreground">
      {view.name === "list" && (
        <SegmentsList
          onCreate={() => setView({ name: "create" })}
          onEdit={(segment) => setView({ name: "edit", segment })}
          onViewContacts={(segment) => setView({ name: "contacts", segment })}
        />
      )}
      {(view.name === "create" || view.name === "edit") && (
        <CreateSegment
          segment={view.name === "edit" ? view.segment : undefined}
          onBack={() => setView({ name: "list" })}
          onSaved={(segment, destination) => setView({ name: "success", segment, destination })}
        />
      )}
      {view.name === "contacts" && (
        <SegmentContacts segment={view.segment} onBack={() => setView({ name: "list" })} />
      )}
      {view.name === "campaign" && (
        <CreateCampaign segment={view.segment} onBack={() => setView({ name: "list" })} />
      )}
      {view.name === "success" && (
        <SuccessScreen
          segment={view.segment}
          onContinue={() => {
            if (view.destination === "contacts") setView({ name: "contacts", segment: view.segment });
            else if (view.destination === "campaign") setView({ name: "campaign", segment: view.segment });
            else setView({ name: "list" });
          }}
        />
      )}
    </div>
  );
}
