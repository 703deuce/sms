"use client";
import { CheckCircle2, Users, Send, PieChart } from "lucide-react";
import { Segment } from "../mock-data";

export default function SegmentSavedModal({ segment, onViewContacts, onViewSegments, onCreateCampaign }: {
  segment: Segment;
  onViewContacts: () => void;
  onViewSegments: () => void;
  onCreateCampaign: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4" onClick={onViewSegments}>
      <div className="w-full max-w-md rounded-2xl bg-card border border-border seg-dropdown seg-fade p-6" onClick={e => e.stopPropagation()}>
        <div className="flex flex-col items-center text-center">
          <span className="h-12 w-12 rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 flex items-center justify-center mb-3"><CheckCircle2 className="h-6 w-6" /></span>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Segment saved</h2>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            <span className="font-medium text-foreground">“{segment.name}”</span> now matches{" "}
            <span className="font-semibold text-indigo-700 tabular-nums">{segment.contacts.toLocaleString()} contacts</span> and will update dynamically.
          </p>
        </div>
        <div className="mt-6 space-y-2">
          <button onClick={onViewContacts} className="seg-btn-primary w-full h-10 rounded-lg text-sm font-medium flex items-center justify-center gap-2"><Users className="h-4 w-4" /> View Contacts</button>
          <button onClick={onCreateCampaign} className="w-full h-10 rounded-lg border border-border bg-card hover:bg-muted text-sm font-medium flex items-center justify-center gap-2 transition-colors"><Send className="h-4 w-4" /> Create Campaign for this Segment</button>
          <button onClick={onViewSegments} className="w-full h-10 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center gap-2 transition-colors"><PieChart className="h-4 w-4" /> Back to Segments</button>
        </div>
      </div>
    </div>
  );
}
