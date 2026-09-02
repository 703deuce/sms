/**
 * Kimi campaigns flow — wired to mass-texting broadcast APIs.
 */
"use client";
import { useRouter } from "next/navigation";
import CampaignsList from "./components/CampaignsList";
import CreateCampaign from "./components/CreateCampaign";
import ReviewDetails from "./components/ReviewDetails";
import { startFreshComposeDraft } from "@/lib/campaigns/compose-draft";

export type CampaignsInitialView = "list" | "create" | "review";

export default function CampaignsUiFlow({ initialView = "list" }: { initialView?: CampaignsInitialView }) {
  const router = useRouter();

  if (initialView === "create") {
    return (
      <CreateCampaign
        onCancel={() => router.push("/campaigns")}
      />
    );
  }

  if (initialView === "review") {
    return (
      <ReviewDetails
        onPrev={() => router.push("/campaigns/new")}
      />
    );
  }

  return (
    <CampaignsList
      onCreate={() => {
        startFreshComposeDraft();
        router.push("/campaigns/new");
      }}
    />
  );
}
