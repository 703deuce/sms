import { DEFAULT_REALTOR_PRODUCT_CONFIG } from "@/lib/realtor/types";
import { saveRealtorProductConfig } from "@/lib/realtor/workspace-config";
import { deployRealEstateFrontDesk } from "@/lib/voice/real-estate/bootstrap";

async function main() {
  const workspaceId = "ws_1";
  const config = {
    ...DEFAULT_REALTOR_PRODUCT_CONFIG,
    enabled: true,
    onboardingComplete: true,
    live: true,
    status: "active" as const,
    amyMode: "front_desk" as const,
    currentStep: "go_live" as const,
    identity: {
      agentName: "Amy",
      greeting: "Warm and professional — mention Summit Ridge Realty",
    },
    business: {
      teamName: "Summit Ridge Realty",
      brokerage: "Summit Ridge Group",
      serviceAreas: ["Fredericksburg", "Stafford", "Spotsylvania"],
      timezone: "America/New_York",
      businessHours: "Mon-Fri 9am-6pm, Sat 10am-2pm",
      teamType: "solo" as const,
    },
    phone: {
      mode: "transovo_number" as const,
      inboundHours: "always" as const,
      inboundNumberE164: "+18663464256",
      transferNumber: "+15714776175",
    },
    frontDesk: {
      buyer: {
        enabled: true,
        qualifiedOutcome: "book" as const,
        fields: DEFAULT_REALTOR_PRODUCT_CONFIG.frontDesk.buyer.fields,
      },
      seller: {
        enabled: true,
        qualifiedOutcome: "notify" as const,
        fields: DEFAULT_REALTOR_PRODUCT_CONFIG.frontDesk.seller.fields,
      },
      showing: { enabled: true, qualifiedOutcome: "book" as const, fields: [] },
      existingClient: { enabled: true, qualifiedOutcome: "message" as const, fields: [] },
      agentToAgent: { enabled: true, qualifiedOutcome: "message" as const, fields: [] },
      general: { enabled: true, qualifiedOutcome: "message" as const, fields: [] },
    },
    knowledge: {
      useRecommended: true,
      customNotes: [
        "We specialize in Fredericksburg and Stafford County residential real estate.",
      ],
    },
    instructions: {
      custom:
        "Always refer to the team as Summit Ridge Realty. If someone asks about commercial property, take a message for the broker.",
    },
  };

  await saveRealtorProductConfig(workspaceId, config);
  const deploy = await deployRealEstateFrontDesk({
    workspaceId,
    productConfig: config,
    phoneE164: "+18663464256",
    agentName: "Summit Ridge Realty Front Desk",
  });

  const saved = await saveRealtorProductConfig(workspaceId, {
    ...config,
    compiledVersion: deploy.compiled?.compiledVersion ?? config.compiledVersion,
    deployedAgentId: deploy.agent?.agentId,
    frontDeskPublishedVersionId: deploy.agent?.publishedVersionId,
    deployedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
  });

  console.log(
    JSON.stringify(
      {
        agentId: deploy.agent?.agentId,
        publishedVersionId: deploy.agent?.publishedVersionId,
        phone: deploy.agent?.phoneE164,
        onboardingComplete: saved.onboardingComplete,
        live: saved.live,
        inbound: saved.phone.inboundNumberE164,
        team: saved.business.teamName,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
