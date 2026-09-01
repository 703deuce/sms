/**
 * Kimi session 2026-08-31T00-54-54-827Z-4d5702 — UI from Kimi draft (mock data, no backend wiring yet).
 */
"use client";

import { useState } from "react";
import AutoRepliesOverview, { Section } from "./components/AutoRepliesOverview";
import OptInMessages from "./components/OptInMessages";
import ComplianceMessaging from "./components/ComplianceMessaging";
import KeywordsList from "./components/KeywordsList";
import KeywordEdit from "./components/KeywordEdit";
import InboxSettings from "./components/InboxSettings";
import { Keyword } from "./mock-data";
import { cn } from "@/lib/utils";
import { MessageSquareReply, ShieldCheck, Tags, Inbox, LayoutGrid } from "lucide-react";

type View = "overview" | "optin" | "compliance" | "keywords" | "keyword-edit" | "inbox";

const tabs: { id: View; label: string; icon: any }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "optin", label: "Opt-In Messages", icon: MessageSquareReply },
  { id: "compliance", label: "Compliance", icon: ShieldCheck },
  { id: "keywords", label: "Keywords", icon: Tags },
  { id: "inbox", label: "Inbox Auto-Response", icon: Inbox },
];

export type AutoRepliesInitialView = View;

export default function AutoRepliesFlow({ initialView = "overview" }: { initialView?: AutoRepliesInitialView }) {
  const [view, setView] = useState<View>(initialView);
  const [editing, setEditing] = useState<Keyword | null>(null);

  const openSection = (s: Section) => setView(s);

  const activeTab = view === "keyword-edit" ? "keywords" : view;

  return (
    <div className="sandbox-root min-h-screen bg-background">
      {/* Feature sub-nav */}
      <div className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-6">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                className={cn(
                  "relative flex items-center gap-2 whitespace-nowrap px-4 py-3.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon
                  size={15}
                  className={cn(
                    "transition-colors",
                    active ? "text-primary" : "text-muted-foreground/70",
                  )}
                />
                {t.label}
                <span
                  className={cn(
                    "absolute inset-x-3 bottom-0 h-[2px] rounded-full transition-all duration-150",
                    active ? "bg-primary opacity-100" : "opacity-0",
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {view === "overview" && <AutoRepliesOverview onOpen={openSection} />}
        {view === "optin" && <OptInMessages onBack={() => setView("overview")} />}
        {view === "compliance" && <ComplianceMessaging onBack={() => setView("overview")} />}
        {view === "keywords" && (
          <KeywordsList
            onBack={() => setView("overview")}
            onEdit={(k) => {
              setEditing(k);
              setView("keyword-edit");
            }}
          />
        )}
        {view === "keyword-edit" && editing && (
          <KeywordEdit
            keyword={editing}
            onBack={() => setView("keywords")}
            onSaved={(k) => setEditing(k)}
          />
        )}
        {view === "inbox" && <InboxSettings onBack={() => setView("overview")} />}
      </div>
    </div>
  );
}
