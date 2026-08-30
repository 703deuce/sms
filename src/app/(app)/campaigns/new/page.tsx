"use client";

import CreateCampaign from "@/components/kimi/campaigns/CreateCampaign";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Kimi create flow — uses CreateCampaign.tsx from session 2026-08-30T21-40-34-537Z-32b6ff */
export default function CreateCampaignPage() {
  const router = useRouter();
  const [lists, setLists] = useState<string[]>([]);
  const [segments, setSegments] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/contacts/lists").then((r) => (r.ok ? r.json() : { data: [] })),
      fetch("/api/contacts/segments").then((r) => (r.ok ? r.json() : { data: [] })),
    ]).then(([listsJson, segmentsJson]) => {
      setLists((listsJson.data || []).map((l: { name: string }) => l.name));
      setSegments((segmentsJson.data || []).map((s: { name: string }) => s.name));
    });
  }, []);

  return (
    <CreateCampaign
      lists={lists}
      segments={segments}
      onCancel={() => router.push("/campaigns")}
      onReview={() => router.push("/campaigns/new/review")}
    />
  );
}
