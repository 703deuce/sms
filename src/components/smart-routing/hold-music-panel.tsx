"use client";

import { SrPrimaryButton, srCard } from "@/components/smart-routing/shared";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";

type HoldTrack = {
  slug: string;
  title: string;
  description: string;
  previewUrl: string;
};

export function HoldMusicPanel() {
  const [tracks, setTracks] = useState<HoldTrack[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("hold-modern-corporate");
  const [mode, setMode] = useState("music");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/smart-routing/hold-music", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) return;
    setTracks(json.data?.systemTracks ?? []);
    setSelectedSlug(json.data?.selectedSlug ?? "hold-modern-corporate");
    setMode(json.data?.holdMusicMode ?? "music");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/smart-routing/hold-music", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          holdMusicSlug: selectedSlug,
          holdMusicMode: mode,
        }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn(srCard, "p-5 space-y-4")}>
      <div>
        <h2 className="text-sm font-semibold">Hold music</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Used when callers wait during transfer, queue, or consultation.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="text-xs font-semibold">Experience</label>
        <select
          className="rounded-lg border px-2 py-1 text-sm"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="music">Hold music</option>
          <option value="ringback">No music / ringback</option>
        </select>
      </div>
      {mode === "music" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {tracks.map((t) => (
            <button
              key={t.slug}
              type="button"
              onClick={() => setSelectedSlug(t.slug)}
              className={cn(
                "rounded-lg border p-3 text-left text-sm transition",
                selectedSlug === t.slug
                  ? "border-[#6366f1] bg-[#eef2ff]"
                  : "border-[#e5e7eb] hover:bg-[#f9fafb]",
              )}
            >
              <p className="font-semibold">{t.title}</p>
              <p className="text-xs text-muted-foreground">{t.description}</p>
              <audio className="mt-2 w-full" controls preload="none" src={t.previewUrl} />
            </button>
          ))}
        </div>
      ) : null}
      <SrPrimaryButton type="button" disabled={saving} onClick={() => void save()}>
        {saving ? "Saving…" : "Save hold music"}
      </SrPrimaryButton>
    </div>
  );
}
