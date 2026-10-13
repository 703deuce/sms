import "server-only";

import {
  classDirectEnrollBlockedReason,
  classRegistrationPaymentRequiredReason,
} from "./class-registration-entitlement";
import { classRegistrationClosedReason } from "@/lib/appointments/public-group-offering";
import {
  fulfillClassRegistrationBySessionId,
  startClassRegistrationCheckout,
  type ClassOfferingKind,
} from "./class-registration-checkout";

export async function handlePublicClassRegistrationAction(
  workspace: { id: string; slug: string },
  offeringKind: ClassOfferingKind,
  body: Record<string, unknown>,
) {
  if (body.action === "fulfillCheckout") {
    const sessionId = String(body.sessionId || "");
    if (!sessionId) throw new Error("sessionId is required");
    return fulfillClassRegistrationBySessionId(workspace.id, sessionId);
  }

  if (body.action === "startCheckout") {
    const result = await startClassRegistrationCheckout({
      workspaceSlug: workspace.slug,
      workspaceId: workspace.id,
      offeringKind,
      firstName: body.firstName ? String(body.firstName) : undefined,
      lastName: body.lastName ? String(body.lastName) : undefined,
      phone: String(body.phone || ""),
      email: body.email ? String(body.email) : undefined,
      occurrenceId: body.occurrenceId ? String(body.occurrenceId) : undefined,
      seriesId: body.seriesId ? String(body.seriesId) : undefined,
      enrollFullSeries: body.enrollFullSeries === true,
      packageBalanceId: body.packageBalanceId ? String(body.packageBalanceId) : undefined,
      membershipSubscriptionId: body.membershipSubscriptionId
        ? String(body.membershipSubscriptionId)
        : undefined,
    });

    if (result.directEnroll) {
      return { directEnroll: true, ...result };
    }
    return result;
  }

  return null;
}

export function assertPublicRegistrationAllowed(
  seriesMetadata: unknown,
  entitlement: {
    packageBalanceId?: string;
    membershipSubscriptionId?: string;
  },
) {
  const closed = classRegistrationClosedReason(seriesMetadata, undefined, {
    skipPaidEnrollmentGuard: Boolean(
      entitlement.packageBalanceId || entitlement.membershipSubscriptionId,
    ),
  });
  if (closed) throw new Error(closed);

  const directBlock = classDirectEnrollBlockedReason(seriesMetadata);
  if (directBlock) throw new Error(directBlock);

  const paymentRequired = classRegistrationPaymentRequiredReason(seriesMetadata, entitlement);
  if (paymentRequired) throw new Error(paymentRequired);
}
