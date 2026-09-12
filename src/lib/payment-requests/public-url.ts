import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";

export function buildPaymentRequestPublicUrl(publicToken: string): string {
  const base = getAppBaseUrl().replace(/\/$/, "");
  return `${base}/p/${publicToken}`;
}
