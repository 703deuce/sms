import assert from "node:assert/strict";
import {
  AR_SETTINGS_BUSINESS,
  AR_SETTINGS_INTEGRATIONS,
  AR_SETTINGS_SCHEDULING,
  AR_ROUTES,
} from "../src/lib/appointment-reminders/routes";
import { buildAppointmentRemindersNav } from "../src/lib/products/appointment-reminders-nav";
import { findBestNavMatch } from "../src/lib/nav-active";
import { mapProductionNavToKimi as mapKimi } from "../src/components/kimi/sidebar/map-nav";

function main() {
  const nav = buildAppointmentRemindersNav();
  const settings = nav.find((i) => i.label === "Settings");
  assert.ok(settings?.children?.length === 4);

  const kimiNav = mapKimi(nav);
  const pathname = AR_ROUTES.settings;

  const scheduling = findBestNavMatch(kimiNav, pathname, "?tab=scheduling");
  assert.equal(scheduling?.href, AR_SETTINGS_SCHEDULING);
  assert.equal(scheduling?.isChild, true);

  const business = findBestNavMatch(kimiNav, pathname, "?tab=business");
  assert.equal(business?.href, AR_SETTINGS_BUSINESS);

  const integrations = findBestNavMatch(kimiNav, pathname, "?tab=integrations");
  assert.equal(integrations?.href, AR_SETTINGS_INTEGRATIONS);

  const sequences = findBestNavMatch(
    kimiNav,
    AR_ROUTES.remindersSequences,
    "",
  );
  assert.ok(
    sequences?.href === AR_ROUTES.remindersSequences ||
      sequences?.href === AR_ROUTES.reminders,
  );

  console.log("test-ar-nav-active: PASS");
}

main();
