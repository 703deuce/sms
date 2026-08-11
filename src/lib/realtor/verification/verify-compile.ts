import assert from "node:assert/strict";
import { DEFAULT_REALTOR_PRODUCT_CONFIG } from "@/lib/realtor/types";
import {
  compileFrontDeskFromProductConfig,
  compileRealtorAgents,
  compileSpeedToLeadFromProductConfig,
  resolveIntentFields,
  validateRealtorProductConfig,
} from "@/lib/voice/real-estate/compile";
import { REAL_ESTATE_TEMPLATE_KEYS } from "@/lib/voice/real-estate/templates/definitions";
import {
  fieldsForIntent,
  isIntentEnabled,
  manifestFromCompiledIntents,
  setActiveFieldManifest,
} from "@/lib/voice/real-estate/fields";
import { projectFileExists, readProjectFile } from "./_read";

export function verifyRealtorCompile(): void {
  assert.ok(projectFileExists("src/lib/voice/real-estate/compile/index.ts"));
  assert.ok(projectFileExists("src/lib/voice/real-estate/templates/definitions.ts"));

  const compiled = compileRealtorAgents(DEFAULT_REALTOR_PRODUCT_CONFIG);
  assert.ok(compiled.frontDesk);
  assert.ok(compiled.speedToLead);
  assert.equal(compiled.frontDesk.templateKey, REAL_ESTATE_TEMPLATE_KEYS.FRONT_DESK);
  assert.equal(compiled.speedToLead.templateKey, REAL_ESTATE_TEMPLATE_KEYS.SPEED_TO_LEAD);
  assert.ok(compiled.frontDesk.workflowDefinition.nodes.length >= 4);
  assert.ok(compiled.speedToLead.qualification.fields.length >= 4);
  assert.ok(compiled.validation.ok);

  const disabledPreapproval = {
    ...DEFAULT_REALTOR_PRODUCT_CONFIG,
    frontDesk: {
      ...DEFAULT_REALTOR_PRODUCT_CONFIG.frontDesk,
      buyer: {
        ...DEFAULT_REALTOR_PRODUCT_CONFIG.frontDesk.buyer,
        fields: DEFAULT_REALTOR_PRODUCT_CONFIG.frontDesk.buyer.fields.map((f) =>
          f.fieldId === "preapproval_status" ? { ...f, enabled: false } : f,
        ),
      },
    },
  };
  const buyerFields = resolveIntentFields("buyer", disabledPreapproval.frontDesk.buyer);
  assert.ok(!buyerFields.some((f) => f.field_id === "preapproval_status"));

  const manifest = manifestFromCompiledIntents(compiled.frontDesk!.intents);
  setActiveFieldManifest(manifest);
  assert.equal(isIntentEnabled("buyer"), true);
  setActiveFieldManifest({ buyer: [] });
  assert.equal(isIntentEnabled("buyer"), false);
  setActiveFieldManifest(null);

  const templates = readProjectFile("src/lib/voice/templates.ts");
  assert.ok(templates.includes("real_estate_front_desk"));
  assert.ok(templates.includes("real_estate_speed_to_lead"));

  const deployAgent = readProjectFile("src/lib/voice/real-estate/deploy-agent.ts");
  assert.ok(deployAgent.includes("realEstateCompiled"));
  assert.ok(deployAgent.includes("ensureAgentPrimaryWorkflow"));
  assert.ok(deployAgent.includes("productConfig"));

  const deploySpeed = readProjectFile("src/lib/realtor/deploy-speed-to-lead.ts");
  assert.ok(deploySpeed.includes("compileSpeedToLeadFromProductConfig"));
  assert.ok(deploySpeed.includes("agentInstanceReference"));

  const buyerDefaults = fieldsForIntent("buyer");
  assert.ok(buyerDefaults.some((f) => f.field_id === "target_areas"));

  const customConfig = compileFrontDeskFromProductConfig({
    ...DEFAULT_REALTOR_PRODUCT_CONFIG,
    business: { teamName: "Smith Realty Group", timezone: "America/New_York" },
  });
  assert.equal(customConfig.identity.companyName, "Smith Realty Group");
  assert.ok(
    !JSON.stringify(customConfig).includes("Blue Ridge"),
    "compiled config must not contain demo customer names",
  );

  const outboundCompiled = compileSpeedToLeadFromProductConfig(DEFAULT_REALTOR_PRODUCT_CONFIG);
  assert.equal(outboundCompiled.qualification.businessName, "Your Real Estate Team");
  assert.ok(outboundCompiled.qualification.fields.length > 0);

  const invalid = validateRealtorProductConfig({
    ...DEFAULT_REALTOR_PRODUCT_CONFIG,
    amyMode: "front_desk",
    frontDesk: {
      ...DEFAULT_REALTOR_PRODUCT_CONFIG.frontDesk,
      buyer: { ...DEFAULT_REALTOR_PRODUCT_CONFIG.frontDesk.buyer, enabled: false },
      seller: { ...DEFAULT_REALTOR_PRODUCT_CONFIG.frontDesk.seller, enabled: false },
      showing: { ...DEFAULT_REALTOR_PRODUCT_CONFIG.frontDesk.showing, enabled: false },
      existingClient: { ...DEFAULT_REALTOR_PRODUCT_CONFIG.frontDesk.existingClient, enabled: false },
      agentToAgent: { ...DEFAULT_REALTOR_PRODUCT_CONFIG.frontDesk.agentToAgent, enabled: false },
      general: { ...DEFAULT_REALTOR_PRODUCT_CONFIG.frontDesk.general, enabled: false },
    },
  });
  assert.equal(invalid.ok, false);
}
