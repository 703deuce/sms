"use client";

import Link from "next/link";
import {
  ClipboardList,
  KeyRound,
  LayoutGrid,
  MessageSquare,
  Plus,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ReputationModuleTabId =
  | "overview"
  | "momentum"
  | "reviews"
  | "keywords"
  | "competitors"
  | "responses"
  | "requests"
  | "tasks";

const MODULE_TABS: Array<{
  id: ReputationModuleTabId;
  label: string;
  icon: typeof LayoutGrid;
  href: (businessId: string) => string;
}> = [
  { id: "overview", label: "Overview", icon: LayoutGrid, href: (id) => `/businesses/${id}/reputation?tab=overview` },
  { id: "momentum", label: "Momentum", icon: TrendingUp, href: (id) => `/businesses/${id}/reputation?tab=momentum` },
  { id: "reviews", label: "Reviews", icon: Star, href: (id) => `/businesses/${id}/reputation?tab=reviews` },
  { id: "keywords", label: "Keywords", icon: KeyRound, href: (id) => `/businesses/${id}/reputation?tab=keywords` },
  { id: "competitors", label: "Competitors", icon: Users, href: (id) => `/businesses/${id}/reputation?tab=competitors` },
  { id: "responses", label: "Responses", icon: MessageSquare, href: (id) => `/businesses/${id}/reputation?tab=responses` },
  {
    id: "requests",
    label: "Review Requests",
    icon: Plus,
    href: (id) => `/businesses/${id}/review-requests`,
  },
  { id: "tasks", label: "Tasks", icon: ClipboardList, href: (id) => `/businesses/${id}/reputation?tab=tasks` },
];

export function ReputationModuleTabs({
  businessId,
  activeTab,
}: {
  businessId: string;
  activeTab: ReputationModuleTabId;
}) {
  return (
    <div className="-mb-px border-b border-zinc-200">
      <div className="flex flex-wrap gap-4 overflow-x-auto">
        {MODULE_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.id === activeTab;
          return (
            <Link
              key={tab.id}
              href={tab.href(businessId)}
              className={cn(
                "-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-1 pb-3 pt-0.5 text-sm transition-colors",
                active
                  ? "border-emerald-600 font-semibold text-emerald-700"
                  : "border-transparent font-medium text-zinc-500 hover:text-zinc-800"
              )}
            >
              <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-emerald-600" : "text-zinc-400")} />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
