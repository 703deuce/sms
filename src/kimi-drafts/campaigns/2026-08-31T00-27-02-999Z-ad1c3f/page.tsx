"use client";
import { useState } from "react";
import Sidebar from "./components/Sidebar";
import CampaignsList from "./components/CampaignsList";
import CreateCampaign from "./components/CreateCampaign";
import ReviewDetails from "./components/ReviewDetails";
import { Check } from "lucide-react";
import "./reference.css";

type View = "list" | "create" | "review";

export default function CampaignsPage() {
  const [view, setView] = useState<View>("list");
  const [draft, setDraft] = useState({ message: "", timing: "Send Immediately" });
  const [toast, setToast] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="flex bg-[#f6f7fb] text-slate-900">
      <Sidebar active="campaigns" />
      {toast && (
        <div className="fixed top-4 right-4 z-50 fade-in flex items-center gap-2 bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg">
          <Check className="w-4 h-4" /> {toast}
        </div>
      )}

      {view === "list" && <CampaignsList onCreate={() => setView("create")} />}

      {view === "create" && (
        <CreateCampaign
          onCancel={() => setView("list")}
          onReview={(data) => { setDraft(data); setView("review"); }}
        />
      )}

      {view === "review" && (
        <ReviewDetails
          message={draft.message}
          timing={draft.timing}
          onPrev={() => setView("create")}
          onSaveDraft={() => { setView("list"); notify("Draft successfully saved."); }}
          onSend={() => { setView("list"); notify("Campaign successfully sent."); }}
        />
      )}
    </div>
  );
}
