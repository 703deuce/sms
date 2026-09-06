"use client";
import { Users, UserCheck, Inbox, PieChart, List, ArrowRight } from "lucide-react";
import { contactStats } from "../mock-data";

export default function Dashboard({ onGoSegments, onGoLists }: { onGoSegments: () => void; onGoLists: () => void }) {
  const cards = [
    { label: "Total Contacts", value: contactStats.totalContacts.toLocaleString(), icon: Users, tint: "bg-primary/10 text-primary ring-primary/20" },
    { label: "Subscribed Contacts", value: contactStats.subscribedContacts.toLocaleString(), icon: UserCheck, tint: "bg-emerald-50 text-emerald-600 ring-emerald-200" },
    { label: "Unread Inbox Messages", value: contactStats.unreadMessages.toLocaleString(), icon: Inbox, tint: "bg-amber-50 text-amber-600 ring-amber-200" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto seg-fade">
      <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground mb-1">Audience Overview</h1>
      <p className="text-sm text-muted-foreground mb-6">A quick glance at what&apos;s happening with your audience.</p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {cards.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="seg-card seg-card-hover rounded-xl border border-border bg-card p-4 flex items-center gap-3.5 transition-all duration-150 hover:-translate-y-px">
              <span className={`h-10 w-10 rounded-full ring-1 flex items-center justify-center shrink-0 ${s.tint}`}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-muted-foreground truncate">{s.label}</p>
                <p className="text-xl font-bold tracking-tight text-foreground tabular-nums">{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="seg-card rounded-xl border border-border bg-card p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <span className="h-10 w-10 rounded-full bg-primary/10 text-primary ring-1 ring-primary/20 flex items-center justify-center shrink-0">
            <PieChart className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Segment your audience</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Build dynamic segments from contact fields, lists, and activity. Membership updates automatically.</p>
          </div>
        </div>
        <div className="flex gap-2.5 shrink-0">
          <button
            onClick={onGoLists}
            className="h-9 px-3.5 rounded-lg border border-border bg-card hover:bg-muted/70 text-sm font-medium text-foreground flex items-center gap-2 transition-colors shadow-sm"
          >
            <List className="h-4 w-4" /> Lists
          </button>
          <button
            onClick={onGoSegments}
            className="seg-btn-primary h-9 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-150 active:scale-[0.98]"
          >
            Go to Segments <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
