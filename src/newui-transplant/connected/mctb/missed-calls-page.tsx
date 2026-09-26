"use client";

import { Page, PageHeader } from "@/newui-transplant/components/app/kit";
import { MissedCallsBrowser } from "@/newui-transplant/components/mctb/missed-calls-browser";
import type { MissedCall } from "@/newui-transplant/lib/view-models";

export function NewUiMctbMissedCallsPage({ missedCalls }: { missedCalls: MissedCall[] }) {
  return (
    <Page>
      <PageHeader
        title="Missed Calls"
        description="Every missed call and how recovery texting is progressing."
      />
      <MissedCallsBrowser missedCalls={missedCalls} />
    </Page>
  );
}
