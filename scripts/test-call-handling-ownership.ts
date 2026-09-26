#!/usr/bin/env tsx
/**
 * Call Handling ownership layer — focused unit tests (no Telnyx).
 * npx tsx scripts/test-call-handling-ownership.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  hasExplicitCallHandlingSelection,
  mergeCallHandlingIntoSettings,
  readCallHandlingBlock,
} from "../src/lib/call-handling/phone-settings";
import { shouldShowCallHandlingSwitcher } from "../src/lib/call-handling/show-switcher";
import { computePublishSkipIngressRouting } from "../src/lib/call-handling/publish-gate";
import {
  CALL_HANDLING_FORBIDDEN_SMS_MUTATION_MARKERS,
  listMctbOutboundSmsSenderCandidates,
  pickMctbOutboundSmsSenderCandidate,
} from "../src/lib/call-handling/outbound-sms-route-proof";

assert.deepEqual(readCallHandlingBlock({}), {
  activeCallHandler: null,
  effectiveCallHandler: null,
  lastProviderVerifiedAt: null,
  routingDrift: false,
  parkedAiReceptionistAgentId: null,
  explicitSelectionAt: null,
  lastSwitchAt: null,
  lastSwitchByUserId: null,
});

import { resolvePersistedEffectiveCallHandler } from "../src/lib/call-handling/phone-settings";
assert.equal(
  resolvePersistedEffectiveCallHandler({
    activeCallHandler: "ai_receptionist",
    effectiveCallHandler: null,
    explicitSelectionAt: "2026-01-01T00:00:00.000Z",
  }),
  "ai_receptionist",
);
assert.equal(
  resolvePersistedEffectiveCallHandler({
    activeCallHandler: "mctb",
    effectiveCallHandler: "mctb",
    explicitSelectionAt: null,
  }),
  "mctb",
);

const ownershipReadSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/call-handling/ownership-state.ts"),
  "utf8",
);
assert.ok(
  !ownershipReadSource.includes("resolveEffectiveCallHandler"),
  "read path must not reconcile call handling via Telnyx",
);
assert.ok(
  !ownershipReadSource.includes("verifyMctbTexmlIngressRoute"),
  "read path must not call MCTB TeXML verify",
);
assert.ok(
  !ownershipReadSource.includes("telnyxRequest"),
  "read path must not call Telnyx",
);

const merged = mergeCallHandlingIntoSettings(
  { voiceEnabled: true },
  {
    activeCallHandler: "mctb",
    parkedAiReceptionistAgentId: "agent-123",
    explicitSelectionAt: "2026-01-01T00:00:00.000Z",
  },
);
assert.equal(readCallHandlingBlock(merged).activeCallHandler, "mctb");
assert.equal(readCallHandlingBlock(merged).parkedAiReceptionistAgentId, "agent-123");
assert.equal(hasExplicitCallHandlingSelection(merged), true);
assert.equal(hasExplicitCallHandlingSelection({ callHandling: { activeCallHandler: "mctb" } }), false);

assert.equal(shouldShowCallHandlingSwitcher({ hasMctb: true, hasVoice: true }), true);
assert.equal(shouldShowCallHandlingSwitcher({ hasMctb: true, hasVoice: false }), false);

const switcherSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/call-handling/set-active-call-handler.ts"),
  "utf8",
);
assert.ok(
  switcherSource.includes("routePhoneToVoiceV3BasicCallControl"),
  "AI switch must use Voice V3 Basic Call Control",
);
assert.ok(
  !switcherSource.includes("routePhoneToTexmlAssistant"),
  "AI switch must NOT use routePhoneToTexmlAssistant",
);
assert.ok(
  switcherSource.includes("routePhoneToMctbCallHandlingIngress"),
  "MCTB switch must use non-destructive MCTB TeXML route",
);
assert.ok(
  !switcherSource.includes("switchDidToMctbTexmlIngress"),
  "MCTB switch must NOT use destructive switchDidToMctbTexmlIngress",
);
assert.ok(
  !switcherSource.includes("syncVoiceAgentPhoneAssignment"),
  "AI switch must NOT reassign agent.phoneNumberId to ingress (preserve separate AI DID)",
);
assert.ok(
  switcherSource.includes("resolveCanonicalVoiceIngressPhoneNumberId"),
  "switch must resolve canonical voice ingress explicitly",
);
for (const marker of CALL_HANDLING_FORBIDDEN_SMS_MUTATION_MARKERS) {
  assert.ok(
    !switcherSource.includes(marker),
    `call handling switch must not mutate SMS pipeline (${marker})`,
  );
}

const ingressResolver = fs.readFileSync(
  path.join(process.cwd(), "src/lib/call-handling/resolve-canonical-voice-ingress.ts"),
  "utf8",
);
assert.ok(
  ingressResolver.includes("runtime.phoneNumberId"),
  "ingress resolves from missedCallTextConfig.phoneNumberId",
);
assert.ok(
  ingressResolver.includes("NOT the MCTB SMS sender"),
  "ingress semantic documented separately from SMS sender",
);

const readinessSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/call-handling/readiness.ts"),
  "utf8",
);
assert.ok(
  !readinessSource.includes("smsPhoneNumberId"),
  "call handling readiness must not conflate SMS sender with voice ingress",
);

const publishGate = fs.readFileSync(
  path.join(process.cwd(), "src/lib/call-handling/publish-gate.ts"),
  "utf8",
);
assert.ok(publishGate.includes("voiceIngressPhoneNumberId"));

assert.equal(
  computePublishSkipIngressRouting({ activeCallHandler: "mctb", targetsIngress: true }),
  true,
  "publish-while-MCTB-active: skip ingress repoint when publish targets ingress",
);
assert.equal(
  computePublishSkipIngressRouting({ activeCallHandler: "mctb", targetsIngress: false }),
  false,
  "publish on non-ingress AI DID may still route that DID",
);
assert.equal(
  computePublishSkipIngressRouting({ activeCallHandler: "ai_receptionist", targetsIngress: true }),
  false,
  "AI publish may route ingress when AI owns call handling",
);

// Topology C — platform / split SMS sender (voice ingress A, SMS C)
const ingressId = "phone-ingress-a";
const platformSmsId = "phone-platform-c";
const candidatesPlatform = listMctbOutboundSmsSenderCandidates(
  { phoneNumberId: ingressId, smsPhoneNumberId: platformSmsId },
  {
    fromPhoneNumberId: { phoneNumberId: ingressId },
    fromSmsPhoneNumberId: { phoneNumberId: platformSmsId },
  },
);
assert.deepEqual(candidatesPlatform.map((c) => c.phoneNumberId), [ingressId, platformSmsId]);
const pickedPlatform = pickMctbOutboundSmsSenderCandidate(candidatesPlatform, (id) =>
  id === platformSmsId,
);
assert.equal(pickedPlatform?.phoneNumberId, platformSmsId);
assert.equal(pickedPlatform?.source, "sms_phone_number_id");

// Topology D — collapsed customer sender (ingress = SMS)
const collapsed = listMctbOutboundSmsSenderCandidates(
  { phoneNumberId: ingressId, smsPhoneNumberId: ingressId },
  {
    fromPhoneNumberId: { phoneNumberId: ingressId },
    fromSmsPhoneNumberId: { phoneNumberId: ingressId },
  },
);
assert.equal(collapsed.length, 1);
assert.equal(
  pickMctbOutboundSmsSenderCandidate(collapsed, () => true)?.phoneNumberId,
  ingressId,
);

// Topology E — split customer sender (ingress A, SMS C) — Call Handling only touches A
const splitCandidates = listMctbOutboundSmsSenderCandidates(
  { phoneNumberId: ingressId, smsPhoneNumberId: "phone-customer-c" },
  {
    fromPhoneNumberId: { phoneNumberId: ingressId },
    fromSmsPhoneNumberId: { phoneNumberId: "phone-customer-c" },
  },
);
assert.equal(splitCandidates.length, 2);
assert.equal(
  pickMctbOutboundSmsSenderCandidate(splitCandidates, (id) => id === "phone-customer-c")
    ?.phoneNumberId,
  "phone-customer-c",
);

// Topology B — separate AI DID: resolver returns aiVoicePhoneNumberId independently
const aiResolver = fs.readFileSync(
  path.join(process.cwd(), "src/lib/call-handling/resolve-ai-receptionist.ts"),
  "utf8",
);
assert.ok(aiResolver.includes("aiVoicePhoneNumberId: agent.phoneNumberId"));
assert.ok(aiResolver.includes("independently of voice ingress"));

// Effective handler inspects only the ingress DID passed in
const effectiveSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/call-handling/effective-handler.ts"),
  "utf8",
);
assert.ok(effectiveSource.includes("verifyMctbTexmlIngressRoute"));
assert.ok(effectiveSource.includes("connection_id"));

console.log("test-call-handling-ownership: PASS");
