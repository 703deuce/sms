import assert from "node:assert/strict";

async function main() {
  assert.equal(
    (await import("../src/lib/mctb/onboarding/demo")).isPlatformDemoNumber("+15714073615"),
    false,
  );

  const { getPlatformDemoPhoneRecord, isWorkspaceAuthorizedForPlatformDemoNumber } = await import(
    "../src/lib/mctb/platform-demo-access"
  );
  assert.equal(await getPlatformDemoPhoneRecord(), null);
  assert.equal(await isWorkspaceAuthorizedForPlatformDemoNumber("ws_1"), false);

  const { resolveMctbProvisionRole } = await import("../src/lib/mctb/provisioning/resolve-mctb-role");
  assert.equal(await resolveMctbProvisionRole({ phoneNumberId: "any" }), "customer_mctb");

  console.log("test-platform-demo-removed: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
