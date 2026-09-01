import { SmsAnalyticsView } from "@/components/sms/sms-analytics-view";
import { Suspense } from "react";

/** SMS Analytics — deep reporting with Overview, Campaigns, Audience, and Messaging tabs. */
export default function SmsAnalyticsPage() {
  return (
    <Suspense fallback={<p className="text-[13px] text-muted-foreground">Loading analytics…</p>}>
      <SmsAnalyticsView />
    </Suspense>
  );
}
