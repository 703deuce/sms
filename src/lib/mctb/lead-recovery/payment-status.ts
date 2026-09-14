export type AuthoritativePaymentState =
  | "PAID"
  | "OPEN"
  | "FAILED"
  | "EXPIRED"
  | "UNKNOWN"
  | "PROVIDER_UNAVAILABLE";

export type PaymentStatusLookup = {
  state: AuthoritativePaymentState;
  customerMessage?: string;
};

let certPaymentStatus: AuthoritativePaymentState = "UNKNOWN";

export function setCertPaymentStatus(state: AuthoritativePaymentState) {
  if (process.env.LR_CERT_E2E === "1") {
    certPaymentStatus = state;
  }
}

export function resetCertPaymentStatus() {
  certPaymentStatus = "UNKNOWN";
}

export async function lookupLeadRecoveryPaymentStatus(input: {
  workspaceId: string;
  conversationId: string;
  customerPhone: string;
}): Promise<PaymentStatusLookup> {
  if (process.env.LR_CERT_E2E === "1") {
    switch (certPaymentStatus) {
      case "PAID":
        return { state: "PAID", customerMessage: "Yes — your payment went through." };
      case "OPEN":
        return { state: "OPEN", customerMessage: "Your payment is still pending." };
      case "FAILED":
        return { state: "FAILED", customerMessage: "That payment did not go through." };
      case "EXPIRED":
        return { state: "EXPIRED", customerMessage: "That payment link expired." };
      case "PROVIDER_UNAVAILABLE":
        return { state: "PROVIDER_UNAVAILABLE" };
      default:
        return { state: "UNKNOWN" };
    }
  }

  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  if (!prisma.paymentRequest?.findFirst) {
    return { state: "PROVIDER_UNAVAILABLE" };
  }
  const row = await prisma.paymentRequest.findFirst({
    where: {
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
    },
    orderBy: { createdAt: "desc" },
    select: { status: true, paidAt: true },
  });
  if (!row) return { state: "UNKNOWN" };
  if (row.paidAt || row.status === "paid") {
    return { state: "PAID", customerMessage: "Yes — your payment went through." };
  }
  if (row.status === "failed") {
    return { state: "FAILED" };
  }
  if (row.status === "expired") {
    return { state: "EXPIRED" };
  }
  if (row.status === "ready" || row.status === "open") {
    return { state: "OPEN" };
  }
  return { state: "UNKNOWN" };
}
