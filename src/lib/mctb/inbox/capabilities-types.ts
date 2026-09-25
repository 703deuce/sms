export type MctbMessagingAuthority =
  | "platform_responses_only"
  | "full_two_way"
  | "messaging_unavailable"
  | "opted_out";

export type MctbInboxCapabilities = {
  senderMode: "PLATFORM" | "WORKSPACE";
  senderReady: boolean;
  canUsePress1: boolean;
  canUseExistingConsent: boolean;
  canUseBookingLink: boolean;
  canUseFreeformMessaging: boolean;
  canUseSavedReplies: boolean;
  canEditMessageContent: boolean;
  canUseAiTwoWayRecovery: boolean;
  messagingAuthority: MctbMessagingAuthority;
  messagingAuthorityHint: string | null;
  upgradeHint: string | null;
  hasApprovedPlatformResponses: boolean;
};
