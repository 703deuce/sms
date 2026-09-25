import type { ProductShell } from "@/lib/products/product-shell";
import type { WorkspaceFeatureSnapshot } from "@/lib/products/feature-entitlements";

export type ResolveProductNavInput = {
  pathname: string;
  inboxBadge?: number;
  multiProduct: boolean;
  productShell: ProductShell;
  primaryVoiceAgentId?: string | null;
  showTryIt?: boolean;
  productFeatures?: WorkspaceFeatureSnapshot | null;
  hasSms?: boolean;
  hasMctb?: boolean;
  hasVoice?: boolean;
  hasNumbers?: boolean;
  smartRoutingFlowId?: string | null;
};
