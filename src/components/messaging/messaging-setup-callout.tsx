"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { Callout } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";

/** Reviews / reputation surfaces — link to workspace SMS compliance when sender is not ready. */
export function MessagingSetupCallout({ businessId: _businessId }: { businessId: string }) {
  return (
    <Callout
      tone="info"
      icon={MessageSquare}
      title="Text-back sender"
      action={
        <Button variant="outline" size="sm" asChild>
          <Link href="/compliance">Open compliance</Link>
        </Button>
      }
    >
      Review requests need an approved business texting sender and recipient consent rules. Finish SMS
      registration in Compliance before sending live review links.
    </Callout>
  );
}
