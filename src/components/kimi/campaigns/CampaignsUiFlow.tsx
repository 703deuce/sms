/**
 * Kimi session 2026-08-31T00-27-02-999Z-ad1c3f — UI from Kimi draft (mock data, no backend wiring yet).
 */
"use client";
import { useState } from "react";
import CampaignsList from "./components/CampaignsList";
import CreateCampaign from "./components/CreateCampaign";
import ReviewDetails from "./components/ReviewDetails";
import { Check } from "lucide-react";
type View = "list" | "create" | "review";

export type CampaignsInitialView = "list" | "create" | "review";

export default function CampaignsUiFlow({ initialView = "list" }: { initialView?: CampaignsInitialView }) {
  const [view, setView] = useState<View>(initialView);
  const [draft, setDraft] = useState({ message: "", timing: "Send Immediately" });
  const [toast, setToast] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="flex bg-[#f6f7fb] text-slate-900">
      {toast && (
        <div className="toast">
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
