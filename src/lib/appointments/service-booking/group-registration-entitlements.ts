import "server-only";

import type { PackageCreditRule } from "./types";
import { packageCreditsRemaining, resolvePackageCreditKey } from "./booking-entitlements";
import { listEligibleEntitlementsForContact, redeemPackageCredit } from "./entitlements";
import { getPrisma } from "@/lib/db";
import { packageGrantsOffering } from "@/lib/appointments/packages/package-form";

export function packageRulesIncludeSeries(
  rules: PackageCreditRule[],
  classSeriesId: string,
  offeringKind: "class" | "workshop",
): boolean {
  return packageGrantsOffering(rules, {
    kind: offeringKind,
    id: classSeriesId,
  });
}

export function pooledCreditKey(remainingCredits: Record<string, number>): string | null {
  return resolvePackageCreditKey(remainingCredits, undefined, undefined);
}

export async function lookupGroupRegistrationEntitlements(input: {
  workspaceId: string;
  contactId: string;
  classSeriesId: string;
  offeringKind: "class" | "workshop";
}) {
  const { packages } = await listEligibleEntitlementsForContact(
    input.workspaceId,
    input.contactId,
  );
  const now = Date.now();

  const eligiblePackages = packages
    .filter((pkg: (typeof packages)[number]) => {
      if (pkg.expiresAt && pkg.expiresAt.getTime() < now) return false;
      const rules = (pkg.product?.creditRules || []) as PackageCreditRule[];
      if (!packageRulesIncludeSeries(rules, input.classSeriesId, input.offeringKind)) {
        return false;
      }
      const credits = (pkg.remainingCredits || {}) as Record<string, number>;
      return pooledCreditKey(credits) != null;
    })
    .map((pkg: (typeof packages)[number]) => {
      const credits = (pkg.remainingCredits || {}) as Record<string, number>;
      const creditKey = pooledCreditKey(credits) || "default";
      return {
        id: pkg.id,
        productName: pkg.product?.name || "Package",
        creditKey,
        creditsRemaining: packageCreditsRemaining(credits),
        expiresAt: pkg.expiresAt?.toISOString() || null,
      };
    });

  return { packages: eligiblePackages };
}

export async function applyGroupRegistrationEntitlement(input: {
  workspaceId: string;
  contactId: string;
  classSeriesId: string;
  offeringKind: "class" | "workshop";
  enrollmentId: string;
  packageBalanceId: string;
}) {
  const prisma = getPrisma();
  const balance = await prisma.packageBalance.findFirst({
    where: {
      id: input.packageBalanceId,
      workspaceId: input.workspaceId,
      contactId: input.contactId,
      status: "active",
    },
    include: { product: true },
  });
  if (!balance) throw new Error("Package balance not found");
  if (balance.expiresAt && balance.expiresAt.getTime() < Date.now()) {
    throw new Error("Package has expired");
  }

  const rules = (balance.product?.creditRules || []) as PackageCreditRule[];
  if (!packageRulesIncludeSeries(rules, input.classSeriesId, input.offeringKind)) {
    throw new Error("This package cannot be used for this booking");
  }

  const credits = (balance.remainingCredits || {}) as Record<string, number>;
  const creditKey = pooledCreditKey(credits);
  if (!creditKey || (credits[creditKey] ?? 0) <= 0) {
    throw new Error("No package credits remaining");
  }

  const label = input.offeringKind === "workshop" ? "workshop" : "class";
  await redeemPackageCredit(
    balance.id,
    input.classSeriesId,
    input.enrollmentId,
    creditKey,
    `Redeemed for ${label} registration ${input.enrollmentId}`,
  );

  return { packageBalanceId: balance.id, creditKey };
}
