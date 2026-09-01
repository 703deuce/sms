"use client";

import { Button } from "@/components/ui/button";
import { Phone, Sparkles } from "lucide-react";
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
    <div className="inline-flex flex-col items-start gap-1.5">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => void dial("softphone")}
          disabled={Boolean(loading) || !phone}
        >
          <Phone className="h-3.5 w-3.5" />
          {loading === "softphone" ? "Opening…" : "Call"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void dial("ai")}
          disabled={Boolean(loading) || !phone}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {loading === "ai" ? "Dialing…" : "AI call"}
        </Button>
      </div>
      {error ? (
        <p className="rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/15">
          {error}
        </p>
      ) : null}
    </div>
  );
}
