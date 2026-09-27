import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ADD_ON_FEATURE_COPY } from "@/lib/products/add-on-feature-copy";
import type { TransovoProductFeature } from "@/lib/products/feature-entitlements";

export function AddOnUpgradeCard({
  feature,
  title,
  description,
}: {
  feature: TransovoProductFeature;
  title?: string;
  description?: string;
}) {
  const copy = ADD_ON_FEATURE_COPY[feature];
  const heading = title ?? copy.title;
  const body = description ?? copy.description;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      </div>
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Add-on not active</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Upgrade your workspace to unlock this feature. Your existing routes and data stay in
              place once enabled.
            </p>
          </div>
          <Link
            href={`/settings/billing?upgrade=${copy.upgradeParam}`}
            className="inline-flex h-9 shrink-0 items-center rounded-[10px] bg-primary px-4 text-[13px] font-semibold text-white hover:bg-primary-hover"
          >
            View upgrade options
          </Link>
        </div>
      </Card>
    </div>
  );
}
