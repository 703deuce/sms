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
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onViewSegments}>
      <div className="w-full max-w-md rounded-xl bg-card border border-border seg-dropdown seg-fade p-6" onClick={e => e.stopPropagation()}>
        <div className="flex flex-col items-center text-center">
          <span className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3"><CheckCircle2 className="h-6 w-6" /></span>
          <h2 className="text-lg font-semibold text-foreground">Segment saved</h2>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-medium text-foreground">“{segment.name}”</span> now matches{" "}
            <span className="font-semibold text-indigo-700">{segment.contacts.toLocaleString()} contacts</span> and will update dynamically.
          </p>
        </div>
        <div className="mt-5 space-y-2">
          <button onClick={onViewContacts} className="w-full h-10 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium flex items-center justify-center gap-2"><Users className="h-4 w-4" /> View Contacts</button>
          <button onClick={onCreateCampaign} className="w-full h-10 rounded-md border border-border bg-card hover:bg-muted text-sm font-medium flex items-center justify-center gap-2"><Send className="h-4 w-4" /> Create Campaign for this Segment</button>
          <button onClick={onViewSegments} className="w-full h-10 rounded-md border border-border bg-card hover:bg-muted text-sm font-medium flex items-center justify-center gap-2"><PieChart className="h-4 w-4" /> Back to Segments</button>
        </div>
      </div>
    </div>
  );
}
