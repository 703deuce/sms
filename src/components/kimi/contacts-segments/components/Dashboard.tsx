"use client";
import { Users, UserCheck, Inbox, ShoppingBag, DollarSign, Tag, PieChart, List, ArrowRight } from "lucide-react";

export default function Dashboard({ onGoSegments }: { onGoSegments: () => void }) {
  return (
    <div className="p-6 max-w-6xl mx-auto seg-fade">
      <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground mb-1">Audience Overview</h1>
      <p className="text-sm text-muted-foreground mb-6">Here's a quick glance at what's happening with your audience.</p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Contacts", value: "6,766", icon: Users, tint: "bg-primary/10 text-primary ring-primary/20" },
          { label: "Subscribed Contacts", value: "2,250", icon: UserCheck, tint: "bg-emerald-50 text-emerald-600 ring-emerald-200" },
          { label: "Unread Inbox Messages", value: "3", icon: Inbox, tint: "bg-amber-50 text-amber-600 ring-amber-200" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="seg-card seg-card-hover rounded-xl border border-border bg-card p-4 flex items-center gap-3.5 transition-all duration-150 hover:shadow-md hover:-translate-y-px">
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

      <div className="grid grid-cols-[1fr_280px] gap-4 mb-6">
        <div className="seg-card rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Total Revenue</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Sep 26th, 2024 – Sep 26th, 2024</p>
            </div>
            <select className="h-8 rounded-lg border border-border bg-card px-2 text-xs text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30">
              <option>Custom Range</option>
            </select>
          </div>
          <div className="flex items-end gap-1.5 h-36 px-0.5">
            {[4, 6, 3, 5, 7, 5, 42, 78, 96, 12, 8, 5, 4, 6, 3, 4].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-md bg-primary/80 hover:bg-primary transition-colors duration-150 cursor-default"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] font-medium text-muted-foreground mt-2 px-0.5">
            <span>12:00 AM</span><span>6:00 AM</span><span>12:00 PM</span><span>6:00 PM</span><span>11:00 PM</span>
          </div>
        </div>
        <div className="space-y-3">
          {[
            { label: "Orders", value: "763", icon: ShoppingBag, tint: "bg-primary/10 text-primary ring-primary/20" },
            { label: "Revenue", value: "$117,717", icon: DollarSign, tint: "bg-emerald-50 text-emerald-600 ring-emerald-200" },
            { label: "Avg. Order Value", value: "$154", icon: Tag, tint: "bg-sky-50 text-sky-600 ring-sky-200" },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="seg-card seg-card-hover rounded-xl border border-border bg-card p-3.5 flex items-center gap-3 transition-all duration-150 hover:shadow-md">
                <span className={`h-9 w-9 rounded-full ring-1 flex items-center justify-center shrink-0 ${s.tint}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-muted-foreground truncate">{s.label}</p>
                  <p className="text-base font-bold tracking-tight text-foreground tabular-nums">{s.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="seg-card rounded-xl border border-border bg-card p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <span className="h-10 w-10 rounded-full bg-primary/10 text-primary ring-1 ring-primary/20 flex items-center justify-center shrink-0">
            <PieChart className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Segment your audience</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Build dynamic segments from contact fields, lists, links and campaigns.</p>
          </div>
        </div>
        <div className="flex gap-2.5 shrink-0">
          <button className="h-9 px-3.5 rounded-lg border border-border bg-card hover:bg-muted/70 text-sm font-medium text-foreground flex items-center gap-2 transition-colors shadow-sm">
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
