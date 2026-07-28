import { InboxView } from "@/components/inbox/inbox-view";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";

export default function InboxUnassignedPage() {
  return (
    <div>
      <PageHeader
        title="Unassigned"
        description="New inbound messages waiting for a team member to claim."
        actions={
          <Link href="/inbox">
            <Button variant="outline">All conversations</Button>
          </Link>
        }
      />
      <InboxView initialFilter="Unassigned" />
    </div>
  );
}
