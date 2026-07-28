import { InboxView } from "@/components/inbox/inbox-view";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";

export default function InboxMinePage() {
  return (
    <div>
      <PageHeader
        title="Assigned to me"
        description="Conversations assigned to you or your team aliases."
        actions={
          <Link href="/inbox">
            <Button variant="outline">All conversations</Button>
          </Link>
        }
      />
      <InboxView initialFilter="Mine" />
    </div>
  );
}
