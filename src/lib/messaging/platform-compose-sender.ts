/** Client-safe id for Transovo shared platform SMS sender in compose UIs. */
export const TRANSOVO_PLATFORM_SENDER_COMPOSE_ID = "__transovo_platform__";

export function isPlatformComposeSenderId(id: string | undefined | null): boolean {
  return id === TRANSOVO_PLATFORM_SENDER_COMPOSE_ID;
}

export type CampaignSendingNumberOption = {
  id: string;
  number: string;
  label: string;
  senderMode: "PLATFORM" | "WORKSPACE";
};
