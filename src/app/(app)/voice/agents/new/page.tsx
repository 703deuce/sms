"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function VoiceAgentNewPage() {
  const router = useRouter();
  useEffect(() => {
    fetch("/api/voice/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New voice agent", agentType: "custom" }),
    })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error);
        router.replace(`/voice/agents/${json.data.id}`);
      })
      .catch(() => router.replace("/voice/agents"));
  }, [router]);
  return <p className="text-muted-foreground">Creating agent…</p>;
}
