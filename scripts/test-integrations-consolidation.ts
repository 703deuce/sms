import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { MCTB_ROUTES } from "../src/lib/mctb/routes";
import { PLATFORM_INTEGRATION_CARDS } from "../src/lib/integrations/platform-integrations";
import { CALENDAR_INTEGRATIONS_PATH } from "../src/lib/calendar/constants";

assert.equal(MCTB_ROUTES.integrations, "/integrations");
assert.ok(PLATFORM_INTEGRATION_CARDS.some((p) => p.id === "microsoft_calendar"));
assert.ok(PLATFORM_INTEGRATION_CARDS.some((p) => p.id === "stripe"));
assert.equal(CALENDAR_INTEGRATIONS_PATH, "/integrations?provider=calendar");

const platform = readFileSync("src/components/integrations/platform-integration-cards.tsx", "utf8");
assert.ok(platform.includes("/api/merchant-payments/stripe/connect"));
assert.ok(platform.includes("/api/integrations/calendars/oauth/"));

const home = readFileSync("src/app/(app)/integrations/integrations-home-client.tsx", "utf8");
assert.ok(home.includes("ConnectableProvidersGrid"));
assert.ok(home.includes("PlatformIntegrationCards"));

const calPage = readFileSync("src/app/(app)/integrations/calendars/page.tsx", "utf8");
assert.ok(calPage.includes('redirect("/integrations'));

const payPage = readFileSync("src/app/(app)/integrations/payments/page.tsx", "utf8");
assert.ok(payPage.includes('redirect("/integrations'));

const nav = readFileSync("src/lib/products/mctb-nav.ts", "utf8");
assert.ok(nav.includes("MCTB_ROUTES.integrations"));

assert.ok(existsSync("docs/INTEGRATIONS-CONSOLIDATION-AUDIT.md"));

console.log("test-integrations-consolidation: OK");
