"use client";

import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { useMemo, useState } from "react";

type Props = {
  guestUrl: string;
  title?: string | null;
  scheduledStartAt?: string | null;
  className?: string;
};

/** Lightweight copy-only guest link when videoMeetingId is unavailable. */
export function GuestJoinLink({
  guestUrl,
  title,
  scheduledStartAt,
  className,
}: Props) {
  const [copied, setCopied] = useState(false);

  const displayUrl = useMemo(() => {
    if (typeof window === "undefined") return guestUrl;
    if (guestUrl.startsWith("http")) return guestUrl;
    return `${window.location.origin}${guestUrl.startsWith("/") ? "" : "/"}${guestUrl}`;
  }, [guestUrl]);

  async function copyLink() {
    const meetingTitle = title || "Transovo Video meeting";
    const when = scheduledStartAt
      ? `When: ${new Date(scheduledStartAt).toLocaleString()}\n`
      : "";
    await navigator.clipboard.writeText(`${meetingTitle}\n${when}Join: ${displayUrl}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-md border bg-muted/40 px-3 py-2 text-xs">
          {displayUrl}
        </code>
        <Button size="sm" variant="outline" onClick={() => void copyLink()}>
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
    </div>
  );
}
