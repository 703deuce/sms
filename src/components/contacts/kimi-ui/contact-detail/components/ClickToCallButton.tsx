"use client";

import { useState } from "react";
import { Button } from "./ui";
import { Phone, Sparkles } from "lucide-react";

export function ClickToCallButton({ phone }: { phone: string }) {
  const [loading, setLoading] = useState<"softphone" | "ai" | null>(null);
  const [error, setError] = useState("");

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
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || "AI dial failed");
        }
        return;
      }
      // Softphone: hand off to the in-app dialer; media stays in-browser.
      window.location.hash = `#/phone?dial=${encodeURIComponent(phone)}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dial failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="outline" onClick={() => void dial("softphone")} disabled={Boolean(loading) || !phone}>
          <Phone style={{ width: 14, height: 14 }} />
          {loading === "softphone" ? "Opening…" : "Call"}
        </Button>
        <Button variant="secondary" onClick={() => void dial("ai")} disabled={Boolean(loading) || !phone}>
          <Sparkles style={{ width: 14, height: 14 }} />
          {loading === "ai" ? "Dialing…" : "AI call"}
        </Button>
      </div>
      {error ? <p className="error-banner" style={{ margin: 0 }}>{error}</p> : null}
    </div>
  );
}
