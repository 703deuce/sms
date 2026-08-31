"use client";
import { Users, List, PieChart } from "lucide-react";

export type AudienceTab = "contacts" | "lists" | "segments";

const tabs: { key: AudienceTab; label: string; icon: any }[] = [
  { key: "contacts", label: "Contacts", icon: Users },
  { key: "lists", label: "Lists", icon: List },
  { key: "segments", label: "Segments", icon: PieChart },
];

export default function AudienceSubNav({ active, onChange }: { active: AudienceTab; onChange: (t: AudienceTab) => void }) {
  return (
    <div className="border-b border-border bg-card px-6">
      <div className="flex items-center gap-1 -mb-px">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-4 py-3">Audience</span>
        {tabs.map(t => {
          const Icon = t.icon;
          const isActive = active === t.key;
          return (
            <button key={t.key} onClick={() => onChange(t.key)}
              className={`flex items-center gap-2 px-3 py-3 text-sm font-medium border-b-2 transition-colors ${isActive ? "border-indigo-600 text-indigo-700" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
