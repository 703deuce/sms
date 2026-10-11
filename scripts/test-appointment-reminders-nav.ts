import assert from "node:assert/strict";
import { AR_ROUTES } from "../src/lib/appointment-reminders/routes";
import { buildAppointmentRemindersNav } from "../src/lib/products/appointment-reminders-nav";
import {
  isExplicitAppointmentRemindersShellPath,
  resolveProductShellFromPath,
  visibleProductShells,
} from "../src/lib/products/product-shell";
import { isMctbV1Primary } from "../src/lib/workspace/platform-launch";

function main() {
  assert.equal(resolveProductShellFromPath(AR_ROUTES.home), "appointment_reminders");
  assert.equal(isExplicitAppointmentRemindersShellPath(AR_ROUTES.settings), true);

  const nav = buildAppointmentRemindersNav();
  assert.ok(nav.some((i) => i.href === AR_ROUTES.appointments));
  assert.ok(nav.some((i) => i.href === AR_ROUTES.reminders));
  assert.ok(nav.some((i) => i.href === AR_ROUTES.settingsBilling));
  const settings = nav.find((i) => i.label === "Settings");
  assert.ok(settings?.children?.length === 4);
  const reminders = nav.find((i) => i.label === "Reminders");
  assert.ok(reminders?.children?.length === 3);

  if (isMctbV1Primary()) {
    const shells = visibleProductShells({
      hasMctb: true,
      hasMassSms: false,
      hasAiAfterHours: false,
      hasAppointmentReminders: true,
    });
    assert.ok(shells.includes("appointment_reminders"));
    assert.ok(shells.includes("mctb"));
  }

  console.log("test-appointment-reminders-nav: PASS");
}

main();
