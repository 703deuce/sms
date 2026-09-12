import { Suspense } from "react";
import { MctbRemindersConnected } from "@/features/mctb/booking/reminders/mctb-reminders-connected";

export default function MctbRemindersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading reminders…</div>}>
      <MctbRemindersConnected />
    </Suspense>
  );
}
