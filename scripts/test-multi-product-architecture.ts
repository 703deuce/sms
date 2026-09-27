/**
 * Multi-product architecture unit checks (no browser required).
 * Run: npx tsx scripts/test-multi-product-architecture.ts
 */
import assert from "node:assert/strict";
import { buildNumbersNav } from "@/lib/products/numbers-nav";
import { buildVoiceNav } from "@/lib/products/voice-nav";
import { buildSmsNav } from "@/lib/products/sms-nav";
import {
  isNumbersMarketplacePath,
  isSmsLegacyHidden,
  isSmsShellRoute,
  SMS_CREATE_ACTIONS,
  SMS_SIDEBAR_HREFS,
} from "@/lib/products/sms-routes";
import { isVoiceProductPath } from "@/lib/products/voice-routes";
import {
  isNumbersProductPath,
  isSmsProductPath,
  resolveProductFromPath,
} from "@/lib/products/paths";
import { resolvePostLoginPath, productAccessDeniedRedirect } from "@/lib/products/routing";
import { productHomePath } from "@/lib/products/types";
import type { UserProductAccess } from "@/lib/products/types";
import {
  isAppointmentsApiPath,
  isAppointmentsPlatformPath,
  isAppointmentsProductPath,
} from "@/lib/products/appointments-routes";
import { isKimiIntegratedRoute } from "@/lib/products/kimi-ui-routes";
import { isAppointmentsV1Primary } from "@/lib/workspace/platform-launch";

function access(
  partial: Partial<UserProductAccess> &
    Pick<UserProductAccess, "hasVoice" | "hasNumbers" | "hasSms">,
): UserProductAccess {
  return {
    products: [],
    lastActiveProduct: null,
    productIntent: null,
    ...partial,
  };
}

// MCTB V1 primary launch: all authenticated users land on MCTB home (Voice hidden).
assert.equal(
  resolvePostLoginPath(access({ hasVoice: true, hasNumbers: false, hasSms: false })),
  "/mctb",
);

// MCTB primary: entitlements do not change default post-login (still MCTB home).
assert.equal(
  resolvePostLoginPath(access({ hasVoice: false, hasNumbers: true, hasSms: false })),
  "/mctb",
);

assert.equal(
  resolvePostLoginPath(
    access({
      hasVoice: true,
      hasNumbers: true,
      hasSms: false,
      lastActiveProduct: "numbers",
    }),
  ),
  "/mctb",
);

assert.equal(
  resolvePostLoginPath(access({ hasVoice: true, hasNumbers: true, hasSms: false })),
  "/mctb",
);

// Deep link preserved
assert.equal(
  resolvePostLoginPath(access({ hasVoice: true, hasNumbers: false, hasSms: false }), {
    nextPath: "/voice/calls/123",
  }),
  "/voice/calls/123",
);

// Path detection
assert.equal(resolveProductFromPath("/dashboard"), "voice");
assert.equal(resolveProductFromPath("/voice/calls"), "voice");
assert.equal(resolveProductFromPath("/personal/vault"), "numbers");
assert.equal(resolveProductFromPath("/app"), null);
assert.equal(resolveProductFromPath("/numbers/premium"), "numbers");
assert.equal(isSmsProductPath("/campaigns"), true);
assert.equal(isSmsProductPath("/auto-replies"), true);
assert.equal(isSmsProductPath("/drip-campaigns"), true);
assert.equal(isSmsProductPath("/ai-replies"), true);
assert.equal(isSmsProductPath("/dashboard"), false);
assert.equal(isVoiceProductPath("/dashboard"), true);
assert.equal(isSmsShellRoute("/dashboard"), true);
assert.equal(isSmsShellRoute("/auto-replies"), true);
assert.equal(isNumbersProductPath("/personal/forwarding"), true);
assert.equal(isNumbersProductPath("/numbers/buy"), false);
assert.equal(isSmsLegacyHidden("/outcomes"), true);
assert.equal(isSmsShellRoute("/compliance/brand"), true);
assert.equal(isSmsShellRoute("/outcomes"), false);
assert.equal(isNumbersMarketplacePath("/numbers/premium"), true);
assert.equal(productHomePath("voice"), "/mctb", "Voice product home follows MCTB shell during launch");

// Legacy shell nav builder (preserved for old chrome; MCTB V1 uses buildMctbV1Nav).
const legacyShellNav = buildVoiceNav({
  showTryIt: false,
  productFeatures: { mctb: "active" } as import("@/lib/products/feature-entitlements").WorkspaceFeatureSnapshot,
});
const legacyLabels = legacyShellNav.map((i) => i.label);
assert.ok(legacyLabels.includes("Missed Calls"), "Legacy shell nav with MCTB entitlement includes missed calls");
assert.ok(legacyLabels.includes("Dashboard"), "Legacy shell nav keeps dashboard entry");

const numbersNav = buildNumbersNav();
const smsNav = buildSmsNav();
const numbersHrefs = numbersNav.map((i) => i.href).join(" ");
assert.ok(!numbersHrefs.includes("/campaigns"), "Numbers nav must not include Campaigns");
assert.ok(numbersHrefs.includes("/personal/vault"), "Numbers nav includes vault");
assert.equal(smsNav.length, 11, "SMS sidebar includes dashboard, drip campaigns, and playbooks");
assert.ok(SMS_CREATE_ACTIONS.length >= 5, "Create menu has primary actions");

assert.equal(
  productAccessDeniedRedirect("/dashboard", {
    hasVoice: false,
    hasNumbers: true,
    hasSms: false,
  }),
  "/mctb",
  "MCTB primary launch redirects legacy platform home to MCTB",
);
assert.equal(
  productAccessDeniedRedirect(
    "/dashboard",
    {
      hasVoice: false,
      hasNumbers: true,
      hasSms: false,
    },
    { authenticated: true },
  ),
  "/mctb",
  "Authenticated legacy platform home redirects to MCTB during launch",
);
assert.equal(
  productAccessDeniedRedirect("/voice/receptionist", {
    hasVoice: true,
    hasNumbers: false,
    hasSms: false,
  }),
  "/mctb",
  "Hidden Voice UI routes redirect to MCTB",
);
assert.equal(
  productAccessDeniedRedirect(
    "/dashboard",
    {
      hasVoice: false,
      hasNumbers: false,
      hasSms: true,
    },
    { authenticated: true },
  ),
  "/mctb",
  "MCTB primary launch redirects legacy /dashboard for all entitlements",
);
assert.equal(
  productAccessDeniedRedirect("/campaigns", {
    hasVoice: true,
    hasNumbers: false,
    hasSms: false,
  }),
  "/mctb",
  "Hidden SMS routes redirect to MCTB home during launch",
);
assert.equal(
  productAccessDeniedRedirect("/sms/dashboard", {
    hasVoice: true,
    hasNumbers: false,
    hasSms: false,
  }),
  "/mass-texting",
  "Standalone SMS hidden — voice-only workspace cannot open SMS dashboard",
);
assert.equal(
  productAccessDeniedRedirect("/sms/analytics", {
    hasVoice: true,
    hasNumbers: false,
    hasSms: false,
  }),
  "/mass-texting",
  "Standalone SMS hidden — voice-only workspace cannot open SMS analytics",
);

if (isAppointmentsV1Primary()) {
  const appointmentsOnlyAccess = {
    hasVoice: false,
    hasNumbers: true,
    hasSms: false,
  };
  for (const route of [
    "/appointments/overview",
    "/appointments/workflows",
    "/appointments/automations/activity",
    "/contacts",
    "/conversations/saved-replies",
    "/settings/business",
    "/integrations/calendars",
    "/payments/transactions",
    "/meetings",
    "/video",
    "/getting-started",
  ] as const) {
    assert.equal(
      productAccessDeniedRedirect(route, appointmentsOnlyAccess, { authenticated: true }),
      null,
      `Appointments shell route ${route} stays reachable`,
    );
    assert.equal(isAppointmentsProductPath(route), true, `${route} is appointments product path`);
  }

  for (const route of [
    "/api/appointments",
    "/api/appointments/overview",
    "/api/appointments/settings",
    "/api/meetings/overview",
    "/api/merchant-payments/status",
    "/api/templates",
    "/api/team",
    "/api/settings/billing",
  ] as const) {
    assert.equal(
      productAccessDeniedRedirect(route, appointmentsOnlyAccess, { authenticated: true }),
      null,
      `Appointments API ${route} stays reachable`,
    );
    assert.equal(isAppointmentsApiPath(route), true, `${route} is appointments API path`);
    assert.equal(isAppointmentsPlatformPath(route), true, `${route} is appointments platform path`);
  }
}

assert.equal(isKimiIntegratedRoute("/appointments/calendar"), true, "Calendar is Kimi integrated");
assert.equal(isKimiIntegratedRoute("/getting-started"), true, "Getting started is Kimi integrated");

console.log("test-multi-product-architecture: all checks passed");
