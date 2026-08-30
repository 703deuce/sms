"use client";

import { useEffect, useMemo, useState } from "react";
import CampaignsList from "./CampaignsList";
import CreateCampaign from "./CreateCampaign";
import ReviewDetails from "./ReviewDetails";
import { apiCampaignToKimi } from "./adapters";
import type { KimiReviewSummary } from "./types";

/**
 * Kimi session 2026-08-30T21-40-34-537Z-32b6ff page.tsx — same view flow, production API wiring.
 * App shell provides the sidebar; this is main content only.
 */
export default function CampaignsFlow() {
  const [view, setView] = useState<"list" | "create" | "review">("list");
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [campaignRows, setCampaignRows] = useState<ReturnType<typeof apiCampaignToKimi>[]>([]);
  const [lists, setLists] = useState<string[]>([]);
  const [segments, setSegments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/mass-texting/campaigns").then((r) => (r.ok ? r.json() : { data: [] })),
      fetch("/api/contacts/lists").then((r) => (r.ok ? r.json() : { data: [] })),
      fetch("/api/contacts/segments").then((r) => (r.ok ? r.json() : { data: [] })),
    ])
      .then(([campaignsJson, listsJson, segmentsJson]) => {
        setCampaignRows((campaignsJson.data || []).map(apiCampaignToKimi));
        setLists((listsJson.data || []).map((l: { name: string }) => l.name));
        setSegments((segmentsJson.data || []).map((s: { name: string }) => s.name));
      })
      .catch(() => setCampaignRows([]))
      .finally(() => setLoading(false));
  }, []);

  const reviewSummary: KimiReviewSummary = useMemo(
    () => ({
      audience: ["Audience selections from compose"],
      count: "—",
      timing: "Send Immediately",
      creditsAvailable: "—",
      creditsRequired: "—",
      creditsRemaining: "—",
    }),
    [],
  );

  const showToast = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 3000);
  };

  if (loading && view === "list") {
    return (
      <div className="st-fade px-2 py-8 text-center text-[14px] text-gray-500">
        Loading campaigns…
      </div>
    );
  }

  return (
    <div className="st-app text-foreground">
      {view === "list" && (
        <CampaignsList
          campaigns={campaignRows}
          onCreate={() => setView("create")}
          toast={toast}
        />
      )}
      {view === "create" && (
        <CreateCampaign
          lists={lists}
          segments={segments}
          onCancel={() => setView("list")}
          onReview={(m) => {
            setMessage(m);
            setView("review");
          }}
        />
      )}
      {view === "review" && (
        <ReviewDetails
          message={message}
          reviewSummary={reviewSummary}
          onPrev={() => setView("create")}
          onDone={(action) => {
            setView("list");
            showToast(
              action === "draft" ? "Draft successfully saved." : "Campaign successfully sent.",
            );
          }}
        />
      )}
    </div>
  );
}
