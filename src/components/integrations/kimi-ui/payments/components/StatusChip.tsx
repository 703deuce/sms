import type { MerchantConnectionStatus } from "../types";

const LABELS: Record<MerchantConnectionStatus, string> = {
  connected: "Connected",
  onboarding_incomplete: "Onboarding incomplete",
  needs_attention: "Needs attention",
  disabled: "Disconnected",
  not_connected: "Not connected",
};

const TONES: Record<MerchantConnectionStatus, string> = {
  connected: "tv-chip tv-chip--success",
  onboarding_incomplete: "tv-chip tv-chip--info",
  needs_attention: "tv-chip tv-chip--warning",
  disabled: "tv-chip tv-chip--neutral",
  not_connected: "tv-chip tv-chip--neutral",
};

export function StatusChip({ status }: { status: MerchantConnectionStatus }) {
  return <span className={TONES[status]}>{LABELS[status]}</span>;
}
