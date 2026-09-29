export type GettingStartedRowTone =
  | "complete"
  | "ready"
  | "active"
  | "needs_setup"
  | "needs_attention"
  | "not_tested"
  | "testing"
  | "pending"
  | "failed"
  | "paused"
  | "locked";

export type GettingStartedEssentialRow = {
  id: string;
  title: string;
  detail: string;
  statusLabel: string;
  tone: GettingStartedRowTone;
  href: string;
  actionLabel: string;
  essential: true;
  complete: boolean;
};

export type GettingStartedCapabilityRow = {
  id: string;
  title: string;
  detail: string;
  statusLabel: string;
  tone: GettingStartedRowTone;
  href: string;
  actionLabel: string;
  locked: boolean;
};

export type GettingStartedAttentionRow = {
  id: string;
  message: string;
  detail?: string | null;
  href: string;
  actionLabel: string;
};

export type MctbGettingStartedPayload = {
  workspaceName: string;
  essentialsComplete: number;
  essentialsTotal: number;
  nextEssentialId: string | null;
  nextEssentialTitle: string | null;
  continueSetupHref: string;
  operationalReady: boolean;
  recoveryPaused: boolean;
  recoveryLabel: string;
  usageLine: string | null;
  essentials: GettingStartedEssentialRow[];
  attention: GettingStartedAttentionRow[];
  capabilities: GettingStartedCapabilityRow[];
};
