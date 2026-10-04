/**
 * Deterministic lifecycle regression for MCTB ingress consent authority.
 * Run: npx tsx scripts/test-mctb-consent-mode-lifecycle.ts
 */
import {
  applyIngressConsentToRoutingProfile,
  resolveIngressConsentAuthority,
} from "../src/lib/mctb/consent-mode-authority-core";

type CaseResult = { name: string; ok: boolean; detail?: string };

function assertEqual(name: string, actual: string, expected: string): CaseResult {
  if (actual !== expected) {
    return { name, ok: false, detail: `expected ${expected}, got ${actual}` };
  }
  return { name, ok: true };
}

function simulateRoutingResolution(input: {
  phoneSettingsJson: unknown;
  workspaceCustomFieldsConfig: unknown;
  shellConsentMode: string;
}) {
  const authority = resolveIngressConsentAuthority({
    phoneSettingsJson: input.phoneSettingsJson,
    workspaceCustomFieldsConfig: input.workspaceCustomFieldsConfig,
  });
  const shell = {
    routingToken: "r_test",
    greetingToken: "g_test",
    workspaceId: "ws_test",
    phoneNumberId: "pn_test",
    e164: "+15551234567",
    consentMode: input.shellConsentMode as "press_1" | "existing_consent",
    automationActive: true,
    press1PlayUrl: "https://example.com/p1.mp3",
    voicemail: { kind: "platform_default" as const, playUrl: "https://example.com/vm.mp3" },
    warmedAt: Date.now(),
  };
  const effective = applyIngressConsentToRoutingProfile(shell, authority);
  return { authority, effective };
}

function runLifecycle(mode: "existing_consent" | "press_1"): CaseResult[] {
  const results: CaseResult[] = [];
  const workspace = {
    mctb: { consentMode: mode, consentConfigRevision: "ccfg_test_1" },
  };
  const phone = {
    mctbInbound: { consentMode: mode, consentConfigRevision: "ccfg_test_1" },
  };

  const wrongShellMode = mode === "existing_consent" ? "press_1" : "existing_consent";

  const steps = [
    () => simulateRoutingResolution({ phoneSettingsJson: phone, workspaceCustomFieldsConfig: workspace, shellConsentMode: wrongShellMode }),
    () =>
      simulateRoutingResolution({
        phoneSettingsJson: phone,
        workspaceCustomFieldsConfig: workspace,
        shellConsentMode: wrongShellMode,
      }),
    () => simulateRoutingResolution({ phoneSettingsJson: {}, workspaceCustomFieldsConfig: workspace, shellConsentMode: wrongShellMode }),
    () => simulateRoutingResolution({ phoneSettingsJson: phone, workspaceCustomFieldsConfig: workspace, shellConsentMode: wrongShellMode }),
  ];

  for (let i = 0; i < steps.length; i++) {
    const { effective, authority } = steps[i]!();
    results.push(assertEqual(`${mode} lifecycle step ${i + 1}`, effective.consentMode, mode));
    if (i === 0 && authority.source !== "phone_mctb_inbound") {
      results.push({
        name: `${mode} step 1 source`,
        ok: false,
        detail: `expected phone_mctb_inbound, got ${authority.source}`,
      });
    }
  }

  return results;
}

function runLegacyMigration(): CaseResult[] {
  const results: CaseResult[] = [];
  const legacyWorkspace = {
    mctbOnboarding: { consentMode: "existing_consent" },
  };
  const authority = resolveIngressConsentAuthority({
    phoneSettingsJson: {},
    workspaceCustomFieldsConfig: legacyWorkspace,
  });
  results.push(assertEqual("legacy migration mode", authority.consentMode, "existing_consent"));
  if (!authority.legacyFallbackUsed) {
    results.push({ name: "legacy migration flag", ok: false, detail: "expected legacyFallbackUsed" });
  }

  const convergedWorkspace = {
    mctb: { consentMode: "existing_consent", consentConfigRevision: "ccfg_migrated" },
  };
  const convergedPhone = {
    mctbInbound: { consentMode: "existing_consent", consentConfigRevision: "ccfg_migrated" },
  };
  const after = resolveIngressConsentAuthority({
    phoneSettingsJson: convergedPhone,
    workspaceCustomFieldsConfig: convergedWorkspace,
  });
  results.push(assertEqual("post-migration mode", after.consentMode, "existing_consent"));
  results.push({
    name: "post-migration no legacy",
    ok: !after.legacyFallbackUsed,
    detail: after.legacyFallbackUsed ? "still on legacy" : undefined,
  });
  return results;
}

function runModeFlip(): CaseResult[] {
  const results: CaseResult[] = [];
  let workspace = { mctb: { consentMode: "press_1" as const } };
  let phone = { mctbInbound: { consentMode: "press_1" as const } };
  results.push(
    assertEqual(
      "flip start",
      simulateRoutingResolution({ phoneSettingsJson: phone, workspaceCustomFieldsConfig: workspace, shellConsentMode: "existing_consent" }).effective.consentMode,
      "press_1",
    ),
  );

  workspace = { mctb: { consentMode: "existing_consent" } };
  phone = { mctbInbound: { consentMode: "existing_consent" } };
  for (let i = 0; i < 3; i++) {
    results.push(
      assertEqual(
        `flip to existing step ${i + 1}`,
        simulateRoutingResolution({ phoneSettingsJson: phone, workspaceCustomFieldsConfig: workspace, shellConsentMode: "press_1" }).effective.consentMode,
        "existing_consent",
      ),
    );
  }

  workspace = { mctb: { consentMode: "press_1" } };
  phone = { mctbInbound: { consentMode: "press_1" } };
  results.push(
    assertEqual(
      "flip back press_1",
      simulateRoutingResolution({ phoneSettingsJson: phone, workspaceCustomFieldsConfig: workspace, shellConsentMode: "existing_consent" }).effective.consentMode,
      "press_1",
    ),
  );
  return results;
}

function main(): void {
  const all = [
    ...runLifecycle("existing_consent"),
    ...runLifecycle("press_1"),
    ...runLegacyMigration(),
    ...runModeFlip(),
  ];
  const failed = all.filter((r) => !r.ok);
  for (const row of all) {
    console.log(row.ok ? "PASS" : "FAIL", row.name, row.detail || "");
  }
  if (failed.length) {
    console.error(`\n${failed.length} failure(s)`);
    process.exit(1);
  }
  console.log(`\nAll ${all.length} lifecycle checks passed.`);
}

main();
