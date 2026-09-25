import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";

/**
 * Call Handling home for AI After Hours — full editors ship on the Voice six-page IA branch.
 * This page avoids presenting legacy inbound-routing rules as active Voice V3 configuration.
 */
export default function VoiceCallHandlingPage() {
  return (
    <div>
      <PageHeader
        title="Call Handling"
        description="Configure how your AI receptionist answers, transfers, and escalates calls."
      />
      <Card className="max-w-2xl space-y-4 p-6">
        <p className="text-sm text-muted-foreground">
          Certified Voice V3 PSTN call handling is configured through Receptionist, Business
          Knowledge, and number provisioning. Legacy inbound routing rule builders are not applied
          on the production Voice V3 path.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/voice/receptionist">Open Receptionist</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/voice/numbers">Manage numbers</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
