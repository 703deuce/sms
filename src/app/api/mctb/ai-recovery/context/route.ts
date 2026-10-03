import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadMctbApprovedBusinessInformation } from "@/lib/mctb/approved-business-information";
import { loadMctbHandoffConfig } from "@/lib/mctb/handoff/config";
import { loadBusinessBrain } from "@/lib/agents/appointment-booking/business-brain";
import { listMctbBookingLinks } from "@/lib/mctb/booking-links/service";
import { hasMctbAiBookingEntitlement } from "@/lib/mctb/ai-booking/entitlement";
import { hasActiveMctbPaidEntitlement } from "@/lib/mctb/entitlement";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { isMctbSetupMessagingReady } from "@/lib/mctb/setup-messaging-ready";
import { loadLeadRecoveryConfigPersisted } from "@/lib/mctb/lead-recovery/config";
import { senderModeCustomerLabel } from "@/lib/mctb/missed-calls-booking-action";
import { deriveRequiredActions } from "@/lib/compliance-helpers";
import { loadComplianceOverview, loadPhoneNumbers } from "@/lib/workspace-data";
import { loadAdminMctbTestFlags } from "@/lib/mctb/admin-test-workspace";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const workspaceId = auth.workspaceId;
    const [business, brain, handoff, config, mctbConfig, entitled, paid, links, phoneNumbers, compliance, adminFlags] =
      await Promise.all([
        loadMctbApprovedBusinessInformation(workspaceId),
        loadBusinessBrain(workspaceId),
        loadMctbHandoffConfig(workspaceId),
        loadLeadRecoveryConfigPersisted(workspaceId),
        loadMissedCallTextConfig(workspaceId),
        hasMctbAiBookingEntitlement(workspaceId),
        hasActiveMctbPaidEntitlement(workspaceId),
        listMctbBookingLinks(workspaceId),
        loadPhoneNumbers(workspaceId, { includeLinked: true }),
        loadComplianceOverview(workspaceId),
        loadAdminMctbTestFlags(workspaceId),
      ]);

    const requiredActions = deriveRequiredActions(compliance.registration, phoneNumbers);
    const messagingReady = isMctbSetupMessagingReady({
      phoneNumbers,
      requiredActions,
      adminFlags,
    });

    const bookingConfigAvailable = entitled && paid;
    const senderExplanation =
      mctbConfig.senderMode === "PLATFORM"
        ? "Transovo uses managed recovery responses to collect information from customers."
        : "AI Recovery can continue the text conversation using your connected messaging number.";

    const serviceArea =
      business.locations.length > 0
        ? business.locations
            .slice(0, 3)
            .map((l) => l.name)
            .join(", ")
        : null;

    return NextResponse.json({
      data: {
        business: {
          name: business.business_name,
          hours: business.business_hours,
          services: business.services.slice(0, 6),
          serviceArea,
          website: business.website,
          aboutBusiness: brain.aboutBusiness ?? "",
          emergencyCriteria: handoff.emergencyCriteria ?? "",
          editHref: "/settings/business",
          knowledgeEditHref: "/voice/knowledge",
        },
        messaging: {
          ready: messagingReady,
          senderLabel: senderModeCustomerLabel(mctbConfig.senderMode),
          setupHref: "/mctb/setup/phone",
        },
        recovery: {
          enabled: config.enabled,
          bookingLinkId: config.bookingLinkId,
          collectCapabilities: config.collectCapabilities,
          enabledScenarios: config.enabledScenarios,
        },
        booking: {
          configAvailable: bookingConfigAvailable,
          links,
          entitled,
          paid,
        },
        copy: {
          senderExplanation,
        },
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
