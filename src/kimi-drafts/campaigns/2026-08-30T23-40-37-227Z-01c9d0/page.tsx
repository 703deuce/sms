"use client";

import { useState } from "react";
import Sidebar from "./components/Sidebar";
import CampaignList from "./components/CampaignList";
import CreateCampaign from "./components/CreateCampaign";
import "./reference.css";

export type View = "list" | "create";

export default function CampaignsPage() {
  const [view, setView] = useState<View>("list");

  return (
    <div className="flex h-screen bg-[#f6f7fb] text-foreground overflow-hidden">
      <Sidebar active="campaigns" />
      <main className="flex-1 overflow-y-auto">
        {view === "list" ? (
          <CampaignList onCreate={() => setView("create")} />
        ) : (
          <CreateCampaign onBack={() => setView("list")} />
        )}
      </main>
    </div>
  );
}
