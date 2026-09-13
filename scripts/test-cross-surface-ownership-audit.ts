#!/usr/bin/env tsx
/**
 * Mechanical cross-surface ownership guards (IA consolidation).
 * Run: npx tsx scripts/test-cross-surface-ownership-audit.ts
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { MCTB_ROUTES } from "../src/lib/mctb/routes";
import { buildMctbV1Nav } from "../src/lib/products/mctb-nav";
import { collectNavHrefs } from "../src/lib/nav";

// 1 — Conversation bridge components exist and use shared APIs
const thread = readFileSync("src/components/inbox/conversations-thread-area.tsx", "utf8");
assert.ok(thread.includes("MctbConversationBookingActions"));
assert.ok(thread.includes("ConversationPaymentActions"));

const bookingActions = readFileSync(
  "src/components/mctb/booking/conversation-booking-actions.tsx",
  "utf8",
);
assert.ok(bookingActions.includes("/api/appointments/types"));
assert.ok(bookingActions.includes("send_booking_link"));
assert.ok(bookingActions.includes("MCTB_ROUTES.appointmentsNew"));

const convPay = readFileSync("src/components/payments/conversation-payments.tsx", "utf8");
assert.ok(convPay.includes("/api/payment-requests"));
assert.ok(!convPay.includes("mctbPayment"));

// 2 — Single PaymentRequest service (no parallel mctb payment lib)
assert.ok(existsSync("src/lib/payment-requests/service.ts"));
const payService = readFileSync("src/lib/payment-requests/service.ts", "utf8");
assert.ok(payService.includes("getMerchantConnection"));
assert.ok(payService.includes("conversationId"));
assert.ok(payService.includes("missedCallId"));

// 3 — Integrations consolidation on canonical page
const platform = readFileSync("src/components/integrations/platform-integration-cards.tsx", "utf8");
assert.ok(platform.includes("/api/merchant-payments/"));
assert.ok(platform.includes("/api/integrations/calendars"));

// 4 — Setup loads onboarding state
const setupApi = readFileSync("src/app/api/mctb/setup/route.ts", "utf8");
assert.ok(setupApi.includes("loadMctbOnboardingState"));
assert.ok(setupApi.includes("saveMctbOnboardingState"));

// 5 — Numbers not in MCTB nav; legacy redirect
const navHrefs = collectNavHrefs(buildMctbV1Nav());
assert.ok(!navHrefs.includes("/mctb/numbers"));
const numbersPage = readFileSync("src/app/(app)/mctb/numbers/page.tsx", "utf8");
assert.ok(numbersPage.includes("redirect"));

// 6 — Shared payment route
assert.equal(MCTB_ROUTES.payments, "/payments");
assert.equal(MCTB_ROUTES.integrations, "/integrations");

// 7 — MCTB analytics isolated route
assert.equal(MCTB_ROUTES.analytics, "/mctb/analytics");
const analyticsView = readFileSync("src/components/mctb/analytics/mctb-analytics-view.tsx", "utf8");
assert.ok(analyticsView.includes("/api/mctb/analytics"));
assert.ok(!analyticsView.includes("/api/payment-requests"));

// 8 — Drawer host shared
assert.ok(existsSync("src/components/mctb/numbers/mctb-number-drawer-host.tsx"));
const onboarding = readFileSync("src/components/mctb/onboarding-wizard.tsx", "utf8");
const phoneSetup = readFileSync("src/components/mctb/setup/setup-phone-forwarding-view.tsx", "utf8");
assert.ok(onboarding.includes("MctbNumberDrawerHost"));
assert.ok(phoneSetup.includes("MctbNumberDrawerHost"));

console.log("test-cross-surface-ownership-audit: OK");
