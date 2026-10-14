import Link from "next/link";
import { CoreScoresRow, type CoreScoreItem } from "@/components/reviews/review-momentum-insights";

export function BusinessCoreScores({
  businessId,
  scores,
}: {
  businessId: string;
  scores: CoreScoreItem[];
}) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Core Scores</h2>
          <p className="mt-1 text-sm text-text-muted">
            At-a-glance health across maps visibility, review momentum, and trust signals.
          </p>
        </div>
        <Link
          href={`/businesses/${businessId}/review-momentum`}
          className="text-sm font-medium text-primary hover:underline"
        >
          Review Momentum™ →
        </Link>
      </div>
      <CoreScoresRow scores={scores} />
    </section>
  );
}
