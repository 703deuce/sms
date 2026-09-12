import type { PaymentRequestDeliveryStatus, PaymentRequestSourceType, PaymentRequestStatus } from "@prisma/client";

/** Stripe Connect checkout metadata discriminator — shared webhook router. */
export const PAYMENT_REQUEST_TRANSACTION_TYPE = "transovo_payment_request";

export function isPaymentRequestCheckoutMetadata(metadata: Record<string, string | undefined>) {
  return metadata.transaction_type === PAYMENT_REQUEST_TRANSACTION_TYPE;
}

export type PaymentRequestCreateInput = {
  workspaceId: string;
  customerPhoneE164: string;
  amountMinor: number;
  currency?: string;
  description: string;
  customerNote?: string | null;
  customerName?: string | null;
  customerId?: string | null;
  contactId?: string | null;
  sourceType?: PaymentRequestSourceType;
  sourceId?: string | null;
  conversationId?: string | null;
  missedCallId?: string | null;
  appointmentId?: string | null;
  createdByUserId?: string | null;
  expiresAt?: Date | null;
  idempotencyKey?: string | null;
  sendSms?: boolean;
};

export type PaymentRequestListFilters = {
  search?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  processor?: string;
  page?: number;
  pageSize?: number;
};

export type PaymentRequestSummary = {
  requestedMinor: number;
  paidMinor: number;
  outstandingMinor: number;
  requestCount: number;
};

export type PaymentRequestView = {
  id: string;
  workspaceId: string;
  processor: string;
  customerName: string | null;
  customerPhoneE164: string;
  amountMinor: number;
  currency: string;
  description: string;
  customerNote: string | null;
  status: PaymentRequestStatus;
  deliveryStatus: PaymentRequestDeliveryStatus;
  sourceType: PaymentRequestSourceType;
  conversationId: string | null;
  missedCallId: string | null;
  appointmentId: string | null;
  publicUrl: string;
  paidAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  sentAt: string | null;
  amountPaidMinor: number | null;
  smsError: string | null;
  processorCheckoutId: string | null;
  messageId: string | null;
};

export type PaymentRequestDetailView = PaymentRequestView & {
  events: Array<{
    id: string;
    eventType: string;
    actorType: string;
    createdAt: string;
    payload?: Record<string, unknown> | null;
  }>;
  stripeConnected: boolean;
};
