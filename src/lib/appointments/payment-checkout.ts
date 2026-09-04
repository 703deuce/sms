import "server-only";

import { getPrisma } from "@/lib/db";
import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";
import { createId } from "@/lib/supabase/id";
import type { PaymentRequirement } from "@/lib/appointments/types";

function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export type AppointmentCheckoutInput = {
  workspaceId: string;
  appointmentId: string;
  payment: PaymentRequirement;
  customerEmail?: string;
  description?: string;
};

export async function createAppointmentCheckoutSession(input: AppointmentCheckoutInput) {
  if (!stripeConfigured()) {
    return {
      configured: false,
      url: null,
      sessionId: null,
      error: "Stripe is not configured. Set STRIPE_SECRET_KEY to enable appointment payments.",
    };
  }

  const amountCents =
    input.payment.mode === "deposit"
      ? input.payment.depositCents || Math.round((input.payment.priceCents || 0) * ((input.payment.depositPercent || 0) / 100))
      : input.payment.priceCents;

  if (!amountCents || amountCents < 50) {
    throw new Error("Payment amount must be at least 50 cents");
  }

  const sessionId = createId();
  const base = getAppBaseUrl();
  const key = process.env.STRIPE_SECRET_KEY!;

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      mode: "payment",
      success_url: `${base}/book/payment/success?session_id={CHECKOUT_SESSION_ID}&appointment=${input.appointmentId}`,
      cancel_url: `${base}/book/payment/canceled?appointment=${input.appointmentId}`,
      ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": (input.payment.currency || "usd").toLowerCase(),
      "line_items[0][price_data][unit_amount]": String(amountCents),
      "line_items[0][price_data][product_data][name]":
        input.description || "Appointment payment",
      "metadata[appointmentId]": input.appointmentId,
      "metadata[workspaceId]": input.workspaceId,
      "metadata[paymentMode]": input.payment.mode,
      "metadata[checkoutSessionId]": sessionId,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Stripe checkout failed: ${errText.slice(0, 200)}`);
  }

  const json = (await res.json()) as { id: string; url: string };

  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
  });
  const existingMeta = (row?.metadata || {}) as Record<string, unknown>;

  await prisma.voiceAppointment.update({
    where: { id: input.appointmentId },
    data: {
      metadata: {
        ...existingMeta,
        paymentStatus: "pending",
        paymentCheckoutSessionId: json.id,
        paymentAmountCents: amountCents,
        paymentMode: input.payment.mode,
      } as object,
    },
  });

  return {
    configured: true,
    url: json.url,
    sessionId: json.id,
    error: null,
  };
}

export async function markAppointmentPaid(
  workspaceId: string,
  appointmentId: string,
  amountCents: number,
  stripeSessionId: string,
) {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!row) return false;

  const meta = (row.metadata || {}) as Record<string, unknown>;
  if (meta.paymentStatus === "paid" && meta.stripeSessionId === stripeSessionId) {
    return true;
  }

  await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: {
      metadata: {
        ...meta,
        paymentStatus: "paid",
        paymentAmountCents: amountCents,
        stripeSessionId,
        paidAt: new Date().toISOString(),
      } as object,
    },
  });

  try {
    const { emitWorkflowTrigger } = await import("@/lib/appointment-workflows/triggers");
    await emitWorkflowTrigger({
      workspaceId,
      appointmentId,
      trigger: "payment_received",
    });
  } catch {
    // workflow trigger optional
  }

  return true;
}

export function isAppointmentCheckoutMetadata(metadata: Record<string, string | undefined>) {
  return Boolean(metadata.appointmentId && metadata.paymentMode);
}

export async function handleAppointmentCheckoutCompleted(
  session: { id: string; metadata?: Record<string, string | null | undefined> | null; amount_total?: number | null },
) {
  const metadata = (session.metadata || {}) as Record<string, string | undefined>;
  const appointmentId = metadata.appointmentId;
  const workspaceId = metadata.workspaceId;
  if (!appointmentId || !workspaceId) {
    return { handled: false, skipped: true };
  }

  const amountCents = session.amount_total ?? Number(metadata.paymentAmountCents || 0);
  await markAppointmentPaid(workspaceId, appointmentId, amountCents, session.id);
  return { handled: true, appointmentId, workspaceId };
}

export async function handleAppointmentCheckoutExpired(
  workspaceId: string,
  appointmentId: string,
) {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!row) return;
  const meta = (row.metadata || {}) as Record<string, unknown>;
  if (meta.paymentStatus === "paid") return;
  await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: {
      metadata: {
        ...meta,
        paymentStatus: "abandoned",
        paymentAbandonedAt: new Date().toISOString(),
      } as object,
    },
  });
}
