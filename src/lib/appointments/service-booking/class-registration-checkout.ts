import "server-only";

import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { getClassRegistrationDb } from "./class-registration-db";
import { getStripe } from "@/lib/stripe/client";
import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";
import { createId } from "@/lib/supabase/id";
import {
  getMerchantConnection,
} from "@/lib/merchant-payments/connection-store";
import { refreshStripeConnectAccount } from "@/lib/merchant-payments/stripe-connect";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { parseClassSeriesMetadata } from "@/lib/appointments/class-series-offering";
import {
  createRegistrationHoldsForOccurrences,
  consumeRegistrationHoldsByGroup,
  enrollFullSeriesAtomic,
  enrollInOccurrenceWithCapacityLock,
  recordClassCheckoutFulfillmentFailure,
  releaseRegistrationHoldsByGroup,
} from "./class-registration-capacity";

export const CLASS_REGISTRATION_CHECKOUT_TYPE = "service_booking_class_registration";

export type ClassOfferingKind = "class" | "workshop";

async function resolveOrCreateContact(
  workspaceId: string,
  input: { firstName?: string; lastName?: string; phone: string; email?: string },
) {
  const prisma = getPrisma();
  const phone = normalizeE164(input.phone);
  const existing = await prisma.contact.findFirst({ where: { workspaceId, phone } });
  if (existing) return existing.id;
  const created = await prisma.contact.create({
    data: {
      workspaceId,
      firstName: input.firstName?.trim() || "Guest",
      lastName: input.lastName?.trim() || "",
      phone,
      email: input.email?.trim() || null,
      status: "SUBSCRIBED",
      consentSource: "class_registration",
      consentDate: new Date(),
    },
  });
  return created.id;
}

export async function resolveRegistrationOccurrenceIds(
  workspaceId: string,
  input: { occurrenceId?: string; seriesId?: string; enrollFullSeries?: boolean },
): Promise<{ occurrenceIds: string[]; seriesId: string }> {
  const prisma = getPrisma();
  if (input.enrollFullSeries && input.seriesId) {
    const occurrences = await prisma.classOccurrence.findMany({
      where: { workspaceId, seriesId: input.seriesId, status: "scheduled" },
      orderBy: { startsAt: "asc" },
    });
    if (!occurrences.length) throw new Error("No scheduled sessions for this course");
    return {
      occurrenceIds: occurrences.map((o) => o.id),
      seriesId: input.seriesId,
    };
  }
  if (!input.occurrenceId) throw new Error("occurrenceId required");
  const occ = await prisma.classOccurrence.findFirst({
    where: { id: input.occurrenceId, workspaceId },
  });
  if (!occ) throw new Error("Session not found");
  return { occurrenceIds: [occ.id], seriesId: occ.seriesId };
}

export function registrationPriceCents(metadata: unknown, enrollFullSeries: boolean): number {
  const meta = parseClassSeriesMetadata(metadata);
  const unit = Number(meta.priceCents ?? 0);
  if (meta.isFree === true || unit <= 0) return 0;
  if (meta.paymentMode === "free" || meta.paymentMode === "package_only") return 0;
  return enrollFullSeries ? unit : unit;
}

async function assertPaidCheckoutAllowed(metadata: unknown) {
  const meta = parseClassSeriesMetadata(metadata);
  const price = registrationPriceCents(metadata, false);
  if (price <= 0) throw new Error("This registration does not require payment");
  if (meta.paymentMode !== "pay_at_registration" && meta.paymentMode !== "on_site") {
    throw new Error("Online payment is not enabled for this offering");
  }
}

export async function startClassRegistrationCheckout(input: {
  workspaceSlug: string;
  workspaceId: string;
  offeringKind: ClassOfferingKind;
  firstName?: string;
  lastName?: string;
  phone: string;
  email?: string;
  occurrenceId?: string;
  seriesId?: string;
  enrollFullSeries?: boolean;
  packageBalanceId?: string;
  membershipSubscriptionId?: string;
}) {
  const prisma = getPrisma();
  const contactId = await resolveOrCreateContact(input.workspaceId, input);

  const { occurrenceIds, seriesId } = await resolveRegistrationOccurrenceIds(input.workspaceId, {
    occurrenceId: input.occurrenceId,
    seriesId: input.seriesId,
    enrollFullSeries: input.enrollFullSeries,
  });

  const series = await prisma.classSeries.findFirst({
    where: { id: seriesId, workspaceId: input.workspaceId },
  });
  if (!series) throw new Error("Series not found");

  const meta = series.metadata;
  const enrollFullSeries = input.enrollFullSeries === true;
  const priceCents = registrationPriceCents(meta, enrollFullSeries);
  await assertPaidCheckoutAllowed(meta);

  if (input.packageBalanceId || input.membershipSubscriptionId) {
    return {
      paymentRequired: false,
      directEnroll: true,
      contactId,
      seriesId,
      occurrenceIds,
      enrollFullSeries,
      packageBalanceId: input.packageBalanceId,
      membershipSubscriptionId: input.membershipSubscriptionId,
    };
  }

  const registrationGroupId = createId();
  const holds = await createRegistrationHoldsForOccurrences({
    workspaceId: input.workspaceId,
    contactId,
    occurrenceIds,
    registrationGroupId,
  });

  const stripe = getStripe();
  if (!stripe) throw new Error("Payments are not configured");
  const connection = await getMerchantConnection(input.workspaceId, "STRIPE");
  if (!connection?.merchantAccountId) throw new Error("Stripe is not connected");
  const refreshed = await refreshStripeConnectAccount(input.workspaceId, connection);
  if (!refreshed.chargesEnabled) throw new Error("This business cannot accept payments yet");

  const base = getAppBaseUrl();
  const holdIds = holds.map((h) => h.id).join(",");
  const primaryOccurrenceId = occurrenceIds[0];

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      success_url: `${base}/book/${encodeURIComponent(input.workspaceSlug)}/${input.offeringKind === "workshop" ? "workshops" : "classes"}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/book/${encodeURIComponent(input.workspaceSlug)}/${input.offeringKind === "workshop" ? "workshops" : "classes"}?checkout=canceled`,
      ...(input.email ? { customer_email: input.email } : {}),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: priceCents,
            product_data: {
              name: enrollFullSeries
                ? `${series.name} (full course)`
                : `${series.name} registration`,
            },
          },
        },
      ],
      metadata: {
        transaction_type: CLASS_REGISTRATION_CHECKOUT_TYPE,
        workspaceId: input.workspaceId,
        contactId,
        seriesId,
        occurrenceId: primaryOccurrenceId,
        enrollFullSeries: enrollFullSeries ? "1" : "0",
        offeringKind: input.offeringKind,
        registrationGroupId,
        holdIds,
        amountCents: String(priceCents),
      },
    },
    { stripeAccount: refreshed.merchantAccountId! },
  );

  for (const hold of holds) {
    await prisma.classOccurrenceRegistrationHold.update({
      where: { id: hold.id },
      data: { stripeCheckoutSessionId: session.id },
    });
  }

  if (!session.url) throw new Error("Unable to start checkout");

  return {
    paymentRequired: true,
    checkoutUrl: session.url,
    sessionId: session.id,
    registrationGroupId,
    contactId,
  };
}

export async function verifyClassRegistrationCheckoutSession(
  workspaceId: string,
  sessionId: string,
) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Payments are not configured");
  const connection = await getMerchantConnection(workspaceId, "STRIPE");
  if (!connection?.merchantAccountId) throw new Error("Stripe is not connected");

  const session = await stripe.checkout.sessions.retrieve(
    sessionId,
    {},
    { stripeAccount: connection.merchantAccountId },
  );

  if (session.payment_status !== "paid" && session.status !== "complete") {
    return { verified: false as const, session };
  }

  const metadata = (session.metadata || {}) as Record<string, string>;
  if (metadata.transaction_type !== CLASS_REGISTRATION_CHECKOUT_TYPE) {
    throw new Error("Invalid checkout session type");
  }
  if (metadata.workspaceId !== workspaceId) {
    throw new Error("Checkout session does not belong to this business");
  }

  const expectedCents = Number(metadata.amountCents || 0);
  const paidCents = session.amount_total ?? 0;
  if (expectedCents > 0 && paidCents < expectedCents) {
    throw new Error("Payment amount does not match registration price");
  }

  return { verified: true as const, session, metadata };
}

async function completePaidRegistration(metadata: Record<string, string>) {
  const workspaceId = metadata.workspaceId;
  const contactId = metadata.contactId;
  const seriesId = metadata.seriesId;
  const enrollFullSeries = metadata.enrollFullSeries === "1";
  const offeringKind = (metadata.offeringKind || "class") as ClassOfferingKind;
  const registrationGroupId = metadata.registrationGroupId;
  const stripeSessionId = metadata.stripeSessionId;

  const paymentMetadata = {
    paymentProvider: "stripe",
    stripeCheckoutSessionId: stripeSessionId,
    paidAt: new Date().toISOString(),
    amountCents: Number(metadata.amountCents || 0),
  };

  try {
    let enrollment;
    if (enrollFullSeries) {
      enrollment = await enrollFullSeriesAtomic(workspaceId, {
        contactId,
        seriesId,
        paymentMetadata,
      });
    } else {
      const occurrenceId = metadata.occurrenceId;
      if (!occurrenceId) throw new Error("Missing occurrence");
      enrollment = await enrollInOccurrenceWithCapacityLock(workspaceId, {
        occurrenceId,
        seriesId,
        contactId,
        paymentMetadata,
      });
    }

    const enrollmentList = Array.isArray(enrollment) ? enrollment : [enrollment];
    const enrollmentIds = enrollmentList.map((e) => e.id);
    if (registrationGroupId) {
      await consumeRegistrationHoldsByGroup(registrationGroupId, enrollmentIds);
    }

    return {
      enrollment: enrollmentList,
      offeringKind,
      packageApplied: null,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Enrollment failed";
    await recordClassCheckoutFulfillmentFailure({
      stripeCheckoutSessionId: stripeSessionId,
      reason,
      recovery: "refund_pending",
    });
    if (registrationGroupId) {
      await releaseRegistrationHoldsByGroup(registrationGroupId);
    }
    throw err;
  }
}

export async function fulfillClassRegistrationCheckoutOnce(session: {
  id: string;
  metadata?: Record<string, string | null | undefined> | null;
}) {
  const prisma = getClassRegistrationDb();
  const metadata = (session.metadata || {}) as Record<string, string | undefined>;
  const workspaceId = metadata.workspaceId;
  if (!workspaceId || metadata.transaction_type !== CLASS_REGISTRATION_CHECKOUT_TYPE) {
    return { handled: false, skipped: true as const };
  }

  const enriched = { ...metadata, stripeSessionId: session.id };

  const existing = await prisma.serviceBookingStoreFulfillment.findUnique({
    where: { stripeSessionId: session.id },
  });
  if (existing?.status === "fulfilled") {
    return { handled: true, duplicate: true as const, result: existing.resultJson };
  }
  if (existing?.status === "failed") {
    return {
      handled: true,
      failed: true as const,
      error: existing.errorMessage || "Fulfillment failed",
    };
  }

  let claimId: string;
  try {
    const claim = await prisma.serviceBookingStoreFulfillment.create({
      data: {
        workspaceId,
        stripeSessionId: session.id,
        transactionType: CLASS_REGISTRATION_CHECKOUT_TYPE,
        status: "processing",
      },
    });
    claimId = claim.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const row = await prisma.serviceBookingStoreFulfillment.findUnique({
        where: { stripeSessionId: session.id },
      });
      if (row?.status === "fulfilled") {
        return { handled: true, duplicate: true as const, result: row.resultJson };
      }
      return { handled: true, inFlight: true as const };
    }
    throw err;
  }

  try {
    const result = await completePaidRegistration(enriched as Record<string, string>);
    await prisma.serviceBookingStoreFulfillment.update({
      where: { id: claimId },
      data: { status: "fulfilled", resultJson: result as object },
    });
    return { handled: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fulfillment failed";
    await prisma.serviceBookingStoreFulfillment.update({
      where: { id: claimId },
      data: { status: "failed", errorMessage: message },
    });
    throw err;
  }
}

export async function fulfillClassRegistrationBySessionId(
  workspaceId: string,
  sessionId: string,
) {
  const verified = await verifyClassRegistrationCheckoutSession(workspaceId, sessionId);
  if (!verified.verified) {
    return { fulfilled: false, status: verified.session.payment_status || verified.session.status };
  }
  const outcome = await fulfillClassRegistrationCheckoutOnce({
    id: verified.session.id,
    metadata: verified.session.metadata,
  });
  return { fulfilled: outcome.handled, result: outcome };
}
