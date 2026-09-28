import {
  MCTB_PLATFORM_TEMPLATE_REGISTRY,
  type MctbPlatformTemplateId,
} from "@/lib/mctb/platform-message-templates";

/** Platform-sender recovery openers the customer may pick in onboarding / text-back (authoritative registry). */
const RECOVERY_OPENER_IDS: MctbPlatformTemplateId[] = [
  "recovery_opener",
  "recovery_opener_concise",
  "recovery_opener_invite",
];

export function listMctbPlatformRecoveryOpenerChoices(): Array<{
  id: MctbPlatformTemplateId;
  label: string;
  body: string;
}> {
  const labels: Record<string, string> = {
    recovery_opener: "Standard recovery",
    recovery_opener_concise: "Concise recovery",
    recovery_opener_invite: "Quick help invite",
  };
  return RECOVERY_OPENER_IDS.map((id) => {
    const row = MCTB_PLATFORM_TEMPLATE_REGISTRY[id];
    return { id, label: labels[id] || row.purpose, body: row.body };
  });
}

export function resolvePlatformRecoveryOpenerBody(templateId?: string | null): string {
  const choices = listMctbPlatformRecoveryOpenerChoices();
  const match = choices.find((c) => c.id === templateId);
  return match?.body ?? choices[0]?.body ?? "";
}
