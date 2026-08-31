/**
 * Backend adapter shell for Kimi auto-replies.
 */
"use client";

import { useCallback, useEffect, useState, type ComponentType } from "react";
import AutoRepliesOverview, { Section } from "@/components/kimi/auto-replies/components/AutoRepliesOverview";
import OptInMessages from "@/components/kimi/auto-replies/components/OptInMessages";
import ComplianceMessaging from "@/components/kimi/auto-replies/components/ComplianceMessaging";
import KeywordsList from "@/components/kimi/auto-replies/components/KeywordsList";
import KeywordEdit from "@/components/kimi/auto-replies/components/KeywordEdit";
import InboxSettings from "@/components/kimi/auto-replies/components/InboxSettings";
import type { Keyword } from "@/components/kimi/auto-replies/mock-data";
import { fetchAutoReplies, mapAutoReplyToKimiKeyword, updateAutoReply, createAutoReply } from "@/lib/auto-replies/kimi-auto-replies-adapter";
import { MessageSquareReply, ShieldCheck, Tags, Inbox, LayoutGrid } from "lucide-react";
import type { AutoRepliesInitialView } from "@/components/kimi/auto-replies/AutoRepliesFlow";

type View = AutoRepliesInitialView;

const tabs: { id: View; label: string; icon: ComponentType<{ size?: number }> }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "optin", label: "Opt-In Messages", icon: MessageSquareReply },
  { id: "compliance", label: "Compliance", icon: ShieldCheck },
  { id: "keywords", label: "Keywords", icon: Tags },
  { id: "inbox", label: "Inbox Auto-Response", icon: Inbox },
];

type Props = { initialView?: View };

export function KimiAutoRepliesConnected({ initialView = "overview" }: Props) {
  const [view, setView] = useState<View>(initialView);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [editing, setEditing] = useState<Keyword | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const rows = await fetchAutoReplies();
    setKeywords(rows.map(mapAutoReplyToKimiKeyword));
  }, []);

  useEffect(() => {
    void reload().catch(() => undefined);
  }, [reload]);

  const openSection = (s: Section) => setView(s);
  const activeTab = view === "keyword-edit" ? "keywords" : view;

  return (
    <div className="sandbox-root min-h-screen bg-background">
      <div className="border-b border-border bg-card sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 flex items-center gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                className={`flex items-center gap-2 px-4 py-3.5 text-[13.5px] font-medium border-b-2 whitespace-nowrap transition-colors ${
                  active
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={15} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        {view === "overview" && <AutoRepliesOverview onOpen={openSection} />}
        {view === "optin" && <OptInMessages onBack={() => setView("overview")} />}
        {view === "compliance" && <ComplianceMessaging onBack={() => setView("overview")} />}
        {view === "keywords" && (
          <KeywordsList
            keywords={keywords}
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
            onSaved={(k) => {
              setError("");
              const savePromise =
                k.id === "new"
                  ? createAutoReply({
                      name: k.keyword || "New auto-reply",
                      triggerType: "list_join",
                      message: k.autoResponse,
                    })
                  : updateAutoReply(k.id, {
                      name: k.keyword,
                      message: k.autoResponse,
                    });
              void savePromise
                .then(() => {
                  void reload();
                  setView("keywords");
                  setEditing(null);
                })
                .catch((err) => setError(err instanceof Error ? err.message : "Save failed"));
            }}
          />
        )}
        {view === "inbox" && <InboxSettings onBack={() => setView("overview")} />}
      </div>
    </div>
  );
}
