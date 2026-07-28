import { CampaignWizard } from "@/components/send/campaign-wizard";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";

export default function SendPage() {
  return (
    <div>
      <PageHeader
        title="New campaign"
        description="Build a compliant campaign with audience estimate, message preview, and scheduling."
        actions={
          <>
            <Link href="/send/quick">
              <Button variant="outline">Quick text</Button>
            </Link>
            <Link href="/send/test">
              <Button variant="outline">Send test</Button>
            </Link>
          </>
        }
      />
      <CampaignWizard />
    </div>
  );
}
