import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";

export default async function RealtorKnowledgePage() {
  await requireRealtorOnboardingComplete();
  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Knowledge" description="RAG + structured business answers for Amy." />
      <p className="text-sm text-muted-foreground">
        Knowledge is deployed automatically with your Real Estate Front Desk agent. Manage sources in{" "}
        <Link href="/voice/agents" className="text-primary">
          Voice Agents
        </Link>
        .
      </p>
    </div>
  );
}
