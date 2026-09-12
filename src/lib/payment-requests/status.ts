import type { PaymentRequestDeliveryStatus, PaymentRequestStatus } from "@prisma/client";

export type UserFacingPaymentStatus =
  | "Draft"
  | "Sent"
  | "Delivered"
  | "Opened"
  | "Paid"
  | "Outstanding"
  | "Failed"
  | "Expired"
  | "Cancelled"
  | "Refunded"
  | "Partially refunded";

export function normalizeUserFacingStatus(
  status: PaymentRequestStatus,
  deliveryStatus: PaymentRequestDeliveryStatus,
): UserFacingPaymentStatus {
  if (status === "paid") return "Paid";
  if (status === "refunded") return "Refunded";
  if (status === "partially_refunded") return "Partially refunded";
  if (status === "cancelled") return "Cancelled";
  if (status === "expired") return "Expired";
  if (status === "failed") return "Failed";
  if (status === "draft") return "Draft";
  if (status === "opened") return "Opened";
  if (deliveryStatus === "delivered") return "Delivered";
  if (status === "sent" || deliveryStatus === "sent" || deliveryStatus === "queued") return "Sent";
  return "Outstanding";
}

export function statusFilterMatches(
  filter: string,
  status: PaymentRequestStatus,
  deliveryStatus: PaymentRequestDeliveryStatus,
): boolean {
  const normalized = normalizeUserFacingStatus(status, deliveryStatus);
  switch (filter) {
    case "all":
      return true;
    case "outstanding":
      return ["Outstanding", "Sent", "Delivered", "Opened", "Draft"].includes(normalized);
    case "paid":
      return normalized === "Paid";
    case "opened":
      return normalized === "Opened";
    case "sent":
      return normalized === "Sent";
    case "delivered":
      return normalized === "Delivered";
    case "failed":
      return normalized === "Failed";
    case "expired":
      return normalized === "Expired";
    case "cancelled":
      return normalized === "Cancelled";
    case "refunded":
      return normalized === "Refunded" || normalized === "Partially refunded";
    default:
      return true;
  }
}
