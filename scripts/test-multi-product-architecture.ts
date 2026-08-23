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

// Voice-only login routing
assert.equal(
  resolvePostLoginPath(access({ hasVoice: true, hasNumbers: false, hasSms: false })),
  "/dashboard",
);

// Numbers-only login routing
assert.equal(
  resolvePostLoginPath(access({ hasVoice: false, hasNumbers: true, hasSms: false })),
  "/personal",
);

// Multi-product with last active
assert.equal(
  resolvePostLoginPath(
    access({
      hasVoice: true,
      hasNumbers: true,
      hasSms: false,
      lastActiveProduct: "numbers",
    }),
  ),
  "/personal",
);

// Multi-product without last active → launcher
assert.equal(
  resolvePostLoginPath(access({ hasVoice: true, hasNumbers: true, hasSms: false })),
  "/app",
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
assert.equal(isSmsProductPath("/dashboard"), false);
assert.equal(isVoiceProductPath("/dashboard"), true);
assert.equal(isNumbersProductPath("/personal/forwarding"), true);
assert.equal(isNumbersProductPath("/numbers/buy"), false);
assert.equal(isSmsLegacyHidden("/outcomes"), true);
assert.equal(isSmsShellRoute("/compliance/brand"), true);
assert.equal(isSmsShellRoute("/outcomes"), false);
assert.equal(isNumbersMarketplacePath("/numbers/premium"), true);
assert.equal(productHomePath("voice"), "/dashboard");

// Sidebar separation — unified nav with SMS + Reviews sections; Numbers hidden from menu
const voiceNav = buildVoiceNav({ showTryIt: false });
const voiceNavTrial = buildVoiceNav({ showTryIt: true });
const numbersNav = buildNumbersNav();
const smsNav = buildSmsNav();
const voiceLabels = voiceNav.map((i) => i.label);
const voiceHrefs = voiceNav.map((i) => i.href).join(" ");
const voiceSections = voiceNav.map((i) => i.sectionLabel).filter(Boolean);
const numbersHrefs = numbersNav.map((i) => i.href).join(" ");
assert.ok(!voiceHrefs.includes("/personal/vault"), "Voice nav must not include Number Vault");
assert.ok(!voiceHrefs.includes("/voice/numbers"), "Voice nav must not include Numbers");
assert.ok(!voiceHrefs.includes("/numbers"), "Voice nav must not include texting Numbers admin");
assert.ok(!numbersHrefs.includes("/campaigns"), "Numbers nav must not include Campaigns");
assert.ok(numbersHrefs.includes("/personal/vault"), "Numbers nav includes vault");
assert.ok(voiceHrefs.includes("/voice/setup"), "Voice nav includes Setup");
assert.ok(voiceLabels.includes("Conversations"), "Voice nav includes Conversations");
assert.ok(voiceLabels.includes("Missed Calls"), "Voice nav includes Missed Calls");
assert.ok(voiceLabels.includes("Inbox"), "Voice nav includes SMS Inbox");
assert.ok(voiceLabels.includes("Reputation Overview"), "Voice nav includes Reviews");
assert.ok(voiceLabels.includes("Messaging Compliance"), "Voice nav includes Messaging Compliance");
assert.ok(!voiceLabels.includes("Receptionist"), "Receptionist removed from voice nav");
assert.ok(!voiceLabels.includes("Knowledge"), "Knowledge removed from voice nav");
assert.ok(!voiceLabels.includes("Numbers"), "Numbers removed from unified nav");
assert.ok(!voiceLabels.includes("Smart Routing"), "Smart Routing hidden from voice nav");
assert.ok(voiceLabels.includes("Overview"), "Voice nav includes Overview");
assert.ok(voiceSections.includes("SMS"), "Voice nav includes SMS section");
assert.ok(voiceSections.includes("Reviews"), "Voice nav includes Reviews section");
assert.ok(voiceNavTrial.map((i) => i.label).includes("Try It"), "Trial voice nav includes Try It");
assert.ok(voiceNav.length > 20, "Unified sidebar includes MCTB + SMS + Reviews");
assert.ok(voiceNavTrial.length > voiceNav.length, "Try It adds one nav item");
assert.equal(smsNav.length, 8, "Standalone SMS sidebar preserved without Numbers");
assert.ok(SMS_CREATE_ACTIONS.length >= 5, "Create menu has primary actions");
assert.ok(!SMS_SIDEBAR_HREFS.includes("/numbers"), "SMS sidebar hrefs omit Numbers");

assert.equal(
  productAccessDeniedRedirect("/dashboard", {
    hasVoice: false,
    hasNumbers: true,
    hasSms: false,
  }),
  "/signup?product=voice",
  "Voice paths gate without entitlement",
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
  "/api/products/open?product=voice",
  "Authenticated voice gate opens product workspace",
);
assert.equal(
  productAccessDeniedRedirect("/campaigns", {
    hasVoice: true,
    hasNumbers: false,
    hasSms: false,
  }),
  null,
  "SMS routes in unified voice shell allow voice entitlement",
);
assert.equal(
  resolveProductFromPath("/campaigns"),
  "voice",
  "Campaigns resolve to voice product in unified shell",
);
assert.equal(
  resolveProductFromPath("/inbox"),
  "voice",
  "Inbox resolves to voice product in unified shell",
);

console.log("test-multi-product-architecture: all checks passed");
