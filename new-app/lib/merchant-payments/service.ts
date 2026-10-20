import "server-only";

import { listMerchantConnections } from "./connection-store";
import type { MerchantConnectionView } from "./types";

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
