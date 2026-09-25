import { isExistingConsentModeEligible } from "@/lib/mctb/setup-consent-eligibility";
import type { MctbInboxCapabilities, MctbMessagingAuthority } from "@/lib/mctb/inbox/capabilities-types";

export function applyConversationComplianceOverrides(
  caps: MctbInboxCapabilities,
  contactStatus?: string | null,
): MctbInboxCapabilities {
  if (contactStatus === "UNSUBSCRIBED") {
    return {
      ...caps,
      canUseFreeformMessaging: false,
      canUseSavedReplies: false,
      canEditMessageContent: false,
      canUseBookingLink: false,
      messagingAuthority: "opted_out",
      messagingAuthorityHint: "This contact has opted out of SMS.",
    };
  }
  return caps;
}

export function deriveMctbInboxCapabilitiesFromInputs(input: {
  senderMode: "PLATFORM" | "WORKSPACE";
  paid: boolean;
  workspaceMessagingReady: boolean;
  platformSenderReady: boolean;
  bookingEntitled: boolean;
  conversationEnabled: boolean;
  contactOptedOut?: boolean;
}): MctbInboxCapabilities {
  const senderReady =
    input.senderMode === "PLATFORM" ? input.platformSenderReady : input.workspaceMessagingReady;

  const canUsePress1 = true;
  const canUseExistingConsent =
    input.paid && isExistingConsentModeEligible({ messagingReady: input.workspaceMessagingReady });

  const canUseBookingLink = input.paid && input.bookingEntitled && senderReady;

  const customerA2pTwoWay =
    input.senderMode === "WORKSPACE" && input.workspaceMessagingReady && senderReady;

  const canUseFreeformMessaging = customerA2pTwoWay;
  const canUseSavedReplies = customerA2pTwoWay;
  const canEditMessageContent = customerA2pTwoWay;

  let messagingAuthority: MctbMessagingAuthority = "messaging_unavailable";
  if (input.senderMode === "PLATFORM" && input.platformSenderReady) {
    messagingAuthority = "platform_responses_only";
  } else if (customerA2pTwoWay) {
    messagingAuthority = "full_two_way";
  }

  const base: MctbInboxCapabilities = {
    senderMode: input.senderMode,
    senderReady,
    canUsePress1,
    canUseExistingConsent,
    canUseBookingLink,
    canUseFreeformMessaging,
    canUseSavedReplies,
    canEditMessageContent,
    canUseAiTwoWayRecovery: input.conversationEnabled,
    messagingAuthority,
    messagingAuthorityHint:
      messagingAuthority === "platform_responses_only"
        ? "Replies from this Transovo number use Transovo-controlled recovery flows. Connect your own approved business number for custom two-way messaging."
        : messagingAuthority === "messaging_unavailable"
          ? "Complete text-back sender setup to send messages from this workspace."
          : null,
    upgradeHint:
      !input.paid && input.senderMode === "PLATFORM"
        ? "Upgrade for booking links and existing-consent mode where eligible."
        : !customerA2pTwoWay && input.senderMode === "PLATFORM"
          ? "Add your own A2P-approved number for custom two-way messaging and saved replies."
          : null,
    hasApprovedPlatformResponses: false,
  };

  if (input.contactOptedOut) {
    return applyConversationComplianceOverrides(base, "UNSUBSCRIBED");
  }
  return base;
}
