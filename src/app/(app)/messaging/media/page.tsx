"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  KimiMediaConnected,
  type MediaCampaignsInitialView,
} from "@/components/messaging/kimi-media-connected";

function MediaPageContent() {
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view") ?? searchParams.get("create");
  const initialView: MediaCampaignsInitialView =
    viewParam === "review" ? "review" : viewParam === "1" || viewParam === "create" ? "create" : "list";

  return (
    <div className="kimi-surface kimi-messaging-media">
      <KimiMediaConnected initialView={initialView} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <MediaPageContent />
    </Suspense>
  );
}
