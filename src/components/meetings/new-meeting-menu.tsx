"use client";

import { Button } from "@/components/ui/button";
import { Plus, Sparkles, Video } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function NewMeetingMenu() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function startInstant() {
    setBusy(true);
    try {
      const res = await fetch("/api/video/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "instant" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      router.push(json.data.hostJoinUrl);
    } catch {
      router.push("/video");
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <Button size="sm" disabled={busy} onClick={() => setOpen((v) => !v)}>
        <Plus className="mr-2 h-4 w-4" />
        New meeting
      </Button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border bg-card p-1 shadow-lg">
          <button
            type="button"
            className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => void startInstant()}
          >
            <Video className="mr-2 h-4 w-4" />
            Start Transovo Video now
          </button>
          <Link
            href="/video"
            className="flex items-center rounded-md px-3 py-2 text-sm hover:bg-muted"
            onClick={() => setOpen(false)}
          >
            <Video className="mr-2 h-4 w-4" />
            Schedule Transovo Video
          </Link>
          <Link
            href="/video"
            className="flex items-center rounded-md px-3 py-2 text-sm hover:bg-muted"
            onClick={() => setOpen(false)}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Add AI Notetaker
          </Link>
        </div>
      ) : null}
    </div>
  );
}
