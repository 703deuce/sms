import { Suspense } from "react";
import { MctbCalendarClient } from "@/components/mctb/booking/mctb-calendar-client";

export default function MctbCalendarPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading calendar…</div>}>
      <MctbCalendarClient />
    </Suspense>
  );
}
