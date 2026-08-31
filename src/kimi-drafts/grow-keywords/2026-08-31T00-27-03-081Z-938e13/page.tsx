"use client";

import { useState } from "react";
import Sidebar from "./components/Sidebar";
import KeywordsList from "./components/KeywordsList";
import KeywordBuilder from "./components/KeywordBuilder";
import { CheckCircle2 } from "lucide-react";
import "./reference.css";

export default function ReferencePage() {
  const [view, setView] = useState<"list" | "create">("list");
  const [toast, setToast] = useState(false);

  const handleSaved = () => {
    setView("list");
    setToast(true);
    setTimeout(() => setToast(false), 3200);
  };

  return (
    <div className="kw-shell">
      <Sidebar />
      <main className="kw-main">
        {view === "list" ? (
          <KeywordsList onCreate={() => setView("create")} />
        ) : (
          <KeywordBuilder onBack={() => setView("list")} onSaved={handleSaved} />
        )}
      </main>
      {toast && (
        <div className="kw-toast">
          <CheckCircle2 size={16} /> Keyword created.
        </div>
      )}
    </div>
  );
}
