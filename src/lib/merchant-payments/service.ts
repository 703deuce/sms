import "server-only";

import type { PaymentRequirement } from "@/lib/appointments/types";
import { calculatePaymentAmounts, resolvePaymentProvider, validatePaymentRequirement } from "./amounts";
import { listMerchantConnections, getMerchantConnection } from "./connection-store";
import { createStripeConnectCheckout } from "./stripe-connect";
import { prepareSquarePayment, createSquarePaymentFromToken, refundSquarePayment } from "./square";
import { refundStripeConnectPayment } from "./stripe-connect";
import { getPaymentByAppointment } from "./payment-record-store";
import type {
  CreateMerchantPaymentInput,
  MerchantConnectionView,
  MerchantPaymentProvider,
  MerchantPaymentResult,
  RefundMerchantPaymentInput,
  SquarePaymentTokenInput,
} from "./types";

export async function getMerchantPaymentStatus(workspaceId: string): Promise<{
  connections: MerchantConnectionView[];
  stripePublishableKey: string | null;
  squareApplicationId: string | null;
}> {
  const connections = await listMerchantConnections(workspaceId);
  return {
    connections,
    stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || null,
    squareApplicationId: process.env.SQUARE_APPLICATION_ID?.trim() || null,
  };
}

export function isProviderAvailableForWorkspace(
  connections: MerchantConnectionView[],
  provider: MerchantPaymentProvider,
): boolean {
  const conn = connections.find((c) => c.provider === provider);
  return Boolean(conn?.canAcceptPayments);
}

export async function validateAppointmentTypePayment(
  workspaceId: string,
  payment: PaymentRequirement,
): Promise<string | null> {
  const fieldError = validatePaymentRequirement(payment);
  if (fieldError) return fieldError;

  if (!payment || payment.mode === "none") return null;

  const provider = resolvePaymentProvider(payment);
  if (!provider) return "Select Stripe or Square as the payment provider";

  const connection = await getMerchantConnection(workspaceId, provider);
  if (!connection?.chargesEnabled) {
    return `${provider === "STRIPE" ? "Stripe" : "Square"} must be connected before requiring payment`;
  }

  return null;
}

export async function createMerchantAppointmentPayment(
  input: CreateMerchantPaymentInput,
): Promise<MerchantPaymentResult> {
  const provider = input.payment.provider;
  if (provider === "STRIPE") return createStripeConnectCheckout(input);
  if (provider === "SQUARE") return prepareSquarePayment(input);

  return {
    configured: false,
    provider: "STRIPE",
    paymentRequired: true,
    checkoutUrl: null,
    sessionId: null,
    paymentRecordId: null,
    error: "Unsupported payment provider",
  };
}

export async function completeSquareAppointmentPayment(
  input: SquarePaymentTokenInput,
): Promise<{ success: boolean; error?: string }> {
  return createSquarePaymentFromToken(input);
}

export async function refundMerchantAppointmentPayment(
  input: RefundMerchantPaymentInput,
): Promise<{ success: boolean; error?: string }> {
  const record = await getPaymentByAppointment(input.workspaceId, input.appointmentId);
  if (!record) return { success: false, error: "No payment found for this appointment" };
  if (!record.providerPaymentId) return { success: false, error: "No processor payment ID" };
  if (record.status !== "succeeded" && record.status !== "partially_refunded") {
    return { success: false, error: "Payment is not in a refundable state" };
  }

  try {
    if (record.provider === "STRIPE") {
      await refundStripeConnectPayment({
        workspaceId: input.workspaceId,
        appointmentId: input.appointmentId,
        amountCents: input.amountCents,
        paymentRecordId: record.id,
        providerPaymentId: record.providerPaymentId,
      });
    } else if (record.provider === "SQUARE") {
      await refundSquarePayment({
        workspaceId: input.workspaceId,
        appointmentId: input.appointmentId,
        amountCents: input.amountCents,
        providerPaymentId: record.providerPaymentId,
      });
    } else {
      return { success: false, error: "Unsupported provider" };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Refund failed" };
  }
}

export async function getConnectedProvidersForBooking(workspaceId: string): Promise<MerchantPaymentProvider[]> {
  const connections = await listMerchantConnections(workspaceId);
  return connections.filter((c) => c.canAcceptPayments).map((c) => c.provider);
}

export function buildPaymentRequirementFromTypeConfig(
  config: PaymentRequirement,
): Omit<PaymentRequirement, "provider"> & { provider: MerchantPaymentProvider | null } {
  const amounts = config.mode !== "none" ? calculatePaymentAmounts(config) : null;
  return {
    ...config,
    provider: resolvePaymentProvider(config),
    ...(amounts ? { priceCents: amounts.totalPriceCents } : {}),
  };
}
