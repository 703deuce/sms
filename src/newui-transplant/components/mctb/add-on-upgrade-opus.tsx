import { Page, PageHeader, Panel } from "@/newui-transplant/components/app/kit";
import { ButtonLink } from "@/newui-transplant/components/app/button-link";
import { ADD_ON_FEATURE_COPY } from "@/lib/products/add-on-feature-copy";
import type { TransovoProductFeature } from "@/lib/products/feature-entitlements";

export function MctbAddOnUpgradeOpus({
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
    <Page>
      <PageHeader title={heading} description={body} />
      <Panel>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Add-on not active</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Upgrade your workspace to unlock this feature. Your existing routes and data stay in place once
              enabled.
            </p>
          </div>
          <ButtonLink href={`/settings/billing?upgrade=${copy.upgradeParam}`}>View upgrade options</ButtonLink>
        </div>
      </Panel>
    </Page>
  );
}
