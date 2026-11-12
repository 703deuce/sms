import { Suspense } from "react";
import { NotetakerHomeClient } from "@/components/meetings/notetaker-home-client";

export default function VideoPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading upcoming meetings…</div>}>
      <NotetakerHomeClient />
    </Suspense>
  );
}
