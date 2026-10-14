import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ReviewsDashboard } from "@/components/reviews/reviews-dashboard";
import { getReputationWorkspaceId } from "@/lib/reputation/workspace-context";

export default async function ReputationReviewsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ReviewsDashboard businessId={businessId} />
    </Suspense>
  );
}