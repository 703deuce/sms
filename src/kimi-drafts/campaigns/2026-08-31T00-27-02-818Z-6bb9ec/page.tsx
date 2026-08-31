"use client";
import { useState } from "react";
import "./reference.css";
import Sidebar from "./components/Sidebar";
import CampaignList from "./components/CampaignList";
import CreateCampaign from "./components/CreateCampaign";
import ReviewDetails from "./components/ReviewDetails";

type View = "list" | "create" | "review";

export default function CampaignsPage() {
  const [view, setView] = useState<View>("list");
  const [toast, setToast] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; message: string; audience: string[] }>({
    name: "",
    message: "",
    audience: [],
  });

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  return (
    <div className="tv-app">
      <Sidebar />
      <main className="tv-main">
        {view === "list" && <CampaignList onCreate={() => setView("create")} />}
        {view === "create" && (
          <CreateCampaign
            onBack={() => setView("list")}
            onReview={(d) => { setDraft(d); setView("review"); }}
          />
        )}
        {view === "review" && (
          <ReviewDetails
            data={draft}
            onBack={() => setView("create")}
            onSend={() => { setView("list"); flash("Campaign sent successfully! 🎉"); }}
            onDraft={() => { setView("list"); flash("Draft successfully saved."); }}
          />
        )}
      </main>
      {toast && <div className="tv-toast">{toast}</div>}
    </div>
  );
}
