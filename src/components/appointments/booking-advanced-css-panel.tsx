"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const THEME_API = "/api/appointments/service-booking/scheduler-theme";

export function BookingAdvancedCssPanel() {
  const [customCss, setCustomCss] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(THEME_API);
    if (!res.ok) return;
    const json = await res.json();
    const theme = json.data?.theme || json.theme || {};
    setCustomCss(String(theme.customCss || ""));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch(THEME_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customCss: customCss.trim() || undefined }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setMessage(json.error || "Save failed");
      return;
    }
    setMessage("Custom CSS saved");
    await load();
  }

  function reset() {
    setCustomCss("");
  }

  return (
    <div className="booking-card space-y-4">
      <div>
        <h2 className="booking-card-title">Advanced CSS</h2>
        <p className="booking-card-desc">
          Add custom styles to your public booking page. Changes apply after save.
        </p>
      </div>
      <textarea
        className="input font-mono text-[12px] min-h-[160px]"
        value={customCss}
        onChange={(e) => setCustomCss(e.target.value)}
        placeholder=".booking-header { … }"
        spellCheck={false}
      />
      <p className="text-[11px] text-amber-800 bg-amber-50 rounded px-2 py-1">
        Custom CSS can affect your public booking experience.
      </p>
      <div className="flex gap-2">
        <Button size="sm" disabled={saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save CSS"}
        </Button>
        <Button size="sm" variant="outline" onClick={reset}>Reset</Button>
      </div>
      {message ? <p className="text-[12px] text-[#6b6f82]">{message}</p> : null}
    </div>
  );
}
