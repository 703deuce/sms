"use client";

import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ClickToCallButton({ phone }: { phone: string }) {
  const [loading, setLoading] = useState<"softphone" | "ai" | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  async function dial(mode: "softphone" | "ai") {
    setLoading(mode);
    setError("");
    try {
      if (mode === "ai") {
        const res = await fetch("/api/voice/calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: phone }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "AI dial failed");
        router.push(json.data?.id ? `/voice/calls/${json.data.id}` : "/voice/calls");
        return;
      }
      // Softphone: hand off to the WebRTC panel so media stays in-browser.
      // Do not place a Call Control dial here — that orphans the media path.
      const params = new URLSearchParams({ dial: phone });
      router.push(`/phone?${params.toString()}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dial failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => void dial("softphone")}
          disabled={Boolean(loading) || !phone}
          className="gap-1"
        >
          <Phone className="h-3.5 w-3.5" />
          {loading === "softphone" ? "Opening…" : "Call"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void dial("ai")}
          disabled={Boolean(loading) || !phone}
        >
          {loading === "ai" ? "Dialing…" : "AI call"}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
