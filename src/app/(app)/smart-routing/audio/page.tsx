"use client";

import { SmartRoutingSubNav } from "@/components/smart-routing/smart-routing-subnav";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useEffect, useState } from "react";

type Asset = {
  id: string;
  name: string;
  sourceType: string;
  providerVoiceId?: string | null;
  durationMs?: number | null;
  status: string;
  processedUrl?: string | null;
  updatedAt: string;
};

export default function SmartRoutingAudioPage() {
  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    fetch("/api/smart-routing/audio")
      .then((r) => r.json())
      .then((j) => setAssets(j.data ?? []));
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHeader
        title="Prompts & Audio"
        description="Reusable greetings and menu audio for Smart Routing flows."
      />
      <SmartRoutingSubNav active="audio" />
      <Card className="divide-y divide-slate-100">
        {assets.length === 0 ? (
          <p className="p-8 text-sm text-slate-500">
            No audio assets yet. Generate a greeting from a flow builder.
          </p>
        ) : (
          assets.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="font-medium text-slate-900">{a.name}</p>
                <p className="text-sm text-slate-500">
                  {a.sourceType.replace(/_/g, " ")} · {a.status}
                </p>
              </div>
              {a.processedUrl && (
                <audio controls src={a.processedUrl} className="h-8 max-w-xs" />
              )}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
