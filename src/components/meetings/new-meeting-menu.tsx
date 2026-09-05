"use client";

import { Button } from "@/components/ui/button";
import { Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function NewMeetingMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button size="sm" onClick={() => setOpen((v) => !v)}>
        <Plus className="mr-2 h-4 w-4" />
        New meeting
      </Button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border bg-card p-1 shadow-lg">
          <Link
            href="/video?mode=add"
            className="flex items-center rounded-md px-3 py-2 text-sm hover:bg-muted"
            onClick={() => setOpen(false)}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Add AI Notetaker now
          </Link>
          <Link
            href="/video?mode=schedule"
            className="flex items-center rounded-md px-3 py-2 text-sm hover:bg-muted"
            onClick={() => setOpen(false)}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Schedule AI Notetaker
          </Link>
        </div>
      ) : null}
    </div>
  );
}
