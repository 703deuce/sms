import {
  MCTB_PLATFORM_TEMPLATE_REGISTRY,
  type MctbPlatformTemplateId,
} from "@/lib/mctb/platform-message-templates";

/** Platform-sender recovery openers the customer may pick in onboarding / text-back (authoritative registry). */
export function listMctbPlatformRecoveryOpenerChoices(): Array<{
  id: MctbPlatformTemplateId;
  label: string;
  body: string;
}> {
  const recovery = MCTB_PLATFORM_TEMPLATE_REGISTRY.recovery_opener;
  return [
    {
      id: recovery.id,
      label: "Transovo recovery opener",
      body: recovery.body,
    },
  ];
}

export function resolvePlatformRecoveryOpenerBody(templateId?: string | null): string {
  const choices = listMctbPlatformRecoveryOpenerChoices();
  const match = choices.find((c) => c.id === templateId);
  return match?.body ?? choices[0]?.body ?? "";
}
