"use client";
import React, { useState } from "react";
import Sidebar from "./components/Sidebar";
import OptInMessages from "./components/OptInMessages";
import Keywords from "./components/Keywords";
import InboxSettings from "./components/InboxSettings";
import { Toast } from "./components/Shared";
import { MessageSquareText, KeyRound, Inbox } from "lucide-react";
import "./reference.css";

type Tab = "optin" | "keywords" | "inbox";

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "optin", label: "Opt-In Messages", icon: MessageSquareText },
  { id: "keywords", label: "Keyword Auto-Responses", icon: KeyRound },
  { id: "inbox", label: "Inbox Auto-Response", icon: Inbox },
];

export default function ReferencePage() {
  const [tab, setTab] = useState<Tab>("optin");
  const [toast, setToast] = useState<string | null>(null);

  return (
    <div className="tv-shell">
      <Sidebar />
      <main className="tv-main">
        <div className="tv-content">
          {/* Breadcrumb */}
          <div className="text-xs tv-muted mb-2">Settings / General</div>
          <h1 className="text-2xl font-bold tracking-tight">Auto-Replies</h1>
          <p className="mt-1 mb-6 text-sm tv-muted">
            Manage the automated messages Transovo sends when contacts opt in, text a keyword, or message your inbox.
          </p>

          {/* Tabs */}
          <div className="flex gap-7 border-b border-[#e6e8f0] mb-7">
            {tabs.map((t) => (
              <button
                key={t.id}
                className={`tv-tab flex items-center gap-2 ${tab === t.id ? "active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                <t.icon size={15} />
                {t.label}
              </button>
            ))}
          </div>

          {tab === "optin" && <OptInMessages />}
          {tab === "keywords" && <Keywords onSave={() => setToast("Keyword saved.")} />}
          {tab === "inbox" && <InboxSettings />}

          <div className="mt-8 flex gap-3">
            <button className="tv-btn-primary" onClick={() => setToast(tab === "inbox" ? "Inbox settings saved." : "Settings saved.")}>
              Save
            </button>
            <button className="tv-btn-ghost">Back</button>
          </div>
        </div>
      </main>
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
