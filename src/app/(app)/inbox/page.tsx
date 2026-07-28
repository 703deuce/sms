import { InboxView } from "@/components/inbox/inbox-view";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";

export default function InboxPage() {
  return (
    <div>
      <PageHeader
        title="Inbox"
        description="Reply to customers, assign conversations, and manage team workflow."
        actions={
          <>
            <Link href="/inbox/saved-replies">
              <Button variant="outline">Saved replies</Button>
            </Link>
            <Link href="/inbox/archived">
              <Button variant="outline">Archived</Button>
            </Link>
          </>
        }
      />
      <InboxView />
    </div>
  );
}
