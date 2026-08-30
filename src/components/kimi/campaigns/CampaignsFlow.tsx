"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CampaignsList from "./CampaignsList";
import CreateCampaign from "./CreateCampaign";
import ReviewDetails from "./ReviewDetails";
import { apiCampaignToKimi } from "./adapters";
import type { KimiComposeSnapshot, KimiReviewSummary } from "./types";
import {
  fetchLaunchReview,
  launchKimiCampaign,
  loadAudiencePickerItems,
  preSendReviewToKimiSummary,
  reloadKimiCampaigns,
  saveKimiCampaign,
  timingLabelFromSnapshot,
  type AudiencePickerItem,
} from "./wiring";

type View = "list" | "create" | "review";

/**
 * Kimi session 2026-08-30T21-40-34-537Z-32b6ff — UI from Kimi, save/send wired to production APIs.
 */
export default function CampaignsFlow({ initialView = "list" }: { initialView?: View }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reviewCampaignId = searchParams.get("id");

  const [view, setView] = useState<View>(initialView);
  const [toast, setToast] = useState<string | null>(null);
  const [campaignRows, setCampaignRows] = useState<ReturnType<typeof apiCampaignToKimi>[]>([]);
  const [lists, setLists] = useState<string[]>([]);
  const [segments, setSegments] = useState<string[]>([]);
  const [pickerItems, setPickerItems] = useState<AudiencePickerItem[]>([]);
  const [defaultNumberId, setDefaultNumberId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [campaignId, setCampaignId] = useState<string | undefined>();
  const [composeSnapshot, setComposeSnapshot] = useState<KimiComposeSnapshot | null>(null);
  const [reviewSummary, setReviewSummary] = useState<KimiReviewSummary | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  const refreshList = useCallback(async () => {
    const rows = await reloadKimiCampaigns();
    setCampaignRows(rows.map(apiCampaignToKimi));
  }, []);

  useEffect(() => {
    Promise.all([refreshList(), loadAudiencePickerItems()])
      .then(([, audience]) => {
        setLists(audience.lists);
        setSegments(audience.segments);
        setPickerItems(audience.pickerItems);
        setDefaultNumberId(audience.defaultNumberId);
      })
      .finally(() => setLoading(false));
  }, [refreshList]);

  const loadReviewForCampaign = useCallback(
    async (id: string, snapshot: KimiComposeSnapshot | null) => {
      setReviewLoading(true);
      setReviewError(null);
      try {
        const review = await fetchLaunchReview(id);
        setReviewSummary(
          preSendReviewToKimiSummary(
            review,
            snapshot ? timingLabelFromSnapshot(snapshot) : "Send Immediately",
          ),
        );
      } catch (err) {
        setReviewError(err instanceof Error ? err.message : "Could not load review");
        setReviewSummary(null);
      } finally {
        setReviewLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (initialView !== "review" || !reviewCampaignId) return;
    setCampaignId(reviewCampaignId);
    setView("review");
    void loadReviewForCampaign(reviewCampaignId, null);
  }, [initialView, reviewCampaignId, loadReviewForCampaign]);

  const showToast = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 3000);
  };

  async function persistDraft(snapshot: KimiComposeSnapshot): Promise<string> {
    const id = await saveKimiCampaign({
      snapshot,
      campaignId,
      pickerItems,
      numberId: defaultNumberId,
    });
    setCampaignId(id);
    return id;
  }

  async function goToReview(snapshot: KimiComposeSnapshot) {
    setReviewError(null);
    try {
      const id = await persistDraft(snapshot);
      setComposeSnapshot(snapshot);
      setView("review");
      await loadReviewForCampaign(id, snapshot);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Could not save campaign");
    }
  }

  async function handleReviewDone(action: "draft" | "send") {
    if (!campaignId) throw new Error("Campaign not saved yet.");
    setReviewError(null);

    if (action === "draft") {
      if (composeSnapshot) await persistDraft(composeSnapshot);
      setView("list");
      await refreshList();
      showToast("Draft successfully saved.");
      return;
    }

    const review = await fetchLaunchReview(campaignId);
    if (!review.canSend) {
      throw new Error(review.blockReason || "Campaign cannot be sent yet.");
    }

    await launchKimiCampaign({
      campaignId,
      confirmLargeSend: review.finalRecipientCount >= 1000,
    });

    const scheduleMode = composeSnapshot?.when === "Later" ? "later" : "now";
    if (scheduleMode === "now") {
      router.push(`/campaigns/new/queue?id=${campaignId}`);
    } else {
      router.push(`/campaigns/new/success?id=${campaignId}&mode=${scheduleMode}`);
    }
  }

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
          onCreate={() => {
            setCampaignId(undefined);
            setComposeSnapshot(null);
            setReviewSummary(null);
            setView("create");
          }}
          toast={toast}
        />
      )}
      {view === "create" && (
        <>
          {reviewError ? <p className="mb-3 text-[13px] text-red-600">{reviewError}</p> : null}
          <CreateCampaign
            lists={lists}
            segments={segments}
            onCancel={() => setView("list")}
            onSaveDraft={async (snapshot) => {
              await persistDraft(snapshot);
              setComposeSnapshot(snapshot);
              setView("list");
              await refreshList();
              showToast("Draft successfully saved.");
            }}
            onReview={(snapshot) => void goToReview(snapshot)}
          />
        </>
      )}
      {view === "review" && (
        <>
          {reviewLoading ? (
            <div className="st-fade px-2 py-8 text-center text-[14px] text-gray-500">
              Loading review…
            </div>
          ) : reviewSummary ? (
            <ReviewDetails
              message={composeSnapshot?.message || ""}
              reviewSummary={reviewSummary}
              error={reviewError}
              onPrev={() => setView("create")}
              onDone={async (action) => {
                try {
                  await handleReviewDone(action);
                } catch (err) {
                  setReviewError(err instanceof Error ? err.message : "Action failed");
                  throw err;
                }
              }}
            />
          ) : (
            <div className="st-fade px-2 py-8 text-center text-[14px] text-red-600">
              {reviewError || "Could not load campaign review."}
            </div>
          )}
        </>
      )}
    </div>
  );
}
