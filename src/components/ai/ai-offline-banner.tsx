"use client";

import { Info } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Shows a banner when the OpenAI integration is unavailable (OPENAI_API_KEY
 * missing on the server). AI tools still work via built-in heuristics, but
 * output quality is reduced — this makes the degraded mode explicit.
 */
export function AiOfflineBanner({ className }: { className?: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/ai/status")
      .then((r) => r.json())
      .then((json) => {
        if (active) setEnabled(Boolean(json?.data?.enabled));
      })
      .catch(() => {
        if (active) setEnabled(null);
      });
    return () => {
      active = false;
    };
  }, []);

  if (enabled !== false) return null;

  return (
    <div
      className={`mb-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 ${className || ""}`}
    >
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
      <div>
        <p className="font-medium text-amber-950">AI is running in offline mode</p>
        <p className="mt-1 text-sm text-amber-900/80">
          No OpenAI API key is configured, so results use built-in heuristics instead of the
          language model. Add <code className="font-mono">OPENAI_API_KEY</code> to enable full AI
          generation.
        </p>
      </div>
    </div>
  );
}
