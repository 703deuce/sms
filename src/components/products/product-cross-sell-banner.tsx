import Link from "next/link";
import type { TransovoProductFeature } from "@/lib/products/feature-entitlements";
import { isActiveEntitlement } from "@/lib/products/types";
import type { ProductAccessStatus } from "@/lib/products/types";

type CrossSellProps = {
  feature: TransovoProductFeature;
  features: Record<TransovoProductFeature, ProductAccessStatus>;
  title: string;
  description: string;
  cta: string;
  href?: string;
};

export function ProductCrossSellBanner({
  feature,
  features,
  title,
  description,
  cta,
  href = "/settings/billing",
}: CrossSellProps) {
  if (isActiveEntitlement(features[feature])) return null;
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 p-4">
      <p className="text-[14px] font-semibold text-[#111827]">{title}</p>
      <p className="mt-1 text-[13px] text-[#4b5563]">{description}</p>
      <Link
        href={href}
        className="mt-3 inline-flex h-9 items-center rounded-lg bg-[#6366f1] px-4 text-[13px] font-semibold text-white hover:bg-[#5558e8]"
      >
        {cta}
      </Link>
    </div>
  );
}
