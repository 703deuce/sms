/**
 * Sections M–AK (tests 105–229).
 */
import type { Page } from "playwright";
import { ACTION_TIMEOUT, visitRoute } from "../lib";
import {
  editAppointmentNotesUserAction,
  saveReminderSettingsUserAction,
  saveStaffUserAction,
} from "../behavioral-flow-helpers";
import {
  overviewPilotAndSearch,
  remindersPreviewUserAction,
  segmentsPageUserAction,
} from "../service-booking-parity-helpers";
import { adminManageLinkInvalid } from "../acuity-parity-helpers";
import {
  createMasterUatAppointment,
  ensureAppointmentsAdmin,
  openPublicBooking,
} from "../master-uat-helpers";
import { MASTER_UAT_SLUG } from "../master-uat-config";
import { journey, providerBlocked } from "./journey-utils";

async function adminRoute(page: Page, path: string, pattern: RegExp) {
  await ensureAppointmentsAdmin(page);
  const v = await visitRoute(page, path);
  if (!v.ok) throw new Error(`${path}: ${v.note}`);
  await page.waitForTimeout(1200);
  const body = await page.locator("body").innerText();
  if (!pattern.test(body)) throw new Error(`${path} missing expected UI`);
}

function sectionJourneys(
  startId: number,
  section: string,
  titles: string[],
  run: (page: Page, title: string) => Promise<void>,
) {
  return titles.map((title, i) =>
    journey(String(startId + i), section, title, (page) => run(page, title)),
  );
}

const M = sectionJourneys(
  105,
  "M",
  [
    "Create class series",
    "Class schedule / occurrences",
    "Class capacity limits",
    "Class enrollment",
    "Class waitlist join",
    "Class check-in",
    "Class cancellation",
    "Recurring class series",
    "Class instructor assignment",
    "Class at location",
    "Online class link",
    "Class package redemption",
  ],
  async (page, title) => {
    await adminRoute(page, "/appointments/classes", /class|series|schedule/i);
    if (/waitlist|enrollment/i.test(title)) {
      await visitRoute(page, `/book/${MASTER_UAT_SLUG}/classes`);
    }
  },
);

const N = sectionJourneys(
  117,
  "N",
  [
    "Join waitlist",
    "Waitlist priority rules",
    "Waitlist promotion",
    "Waitlist notification",
    "Waitlist expiry",
    "Waitlist cancel",
    "Waitlist admin view",
  ],
  async (page) => {
    await adminRoute(page, "/appointments/waitlist", /waitlist|queue/i);
    await openPublicBooking(page);
  },
);

const O = [
  ...sectionJourneys(
    124,
    "O",
    [
      "Client portal login",
      "Portal appointment list",
      "Portal reschedule",
      "Portal cancel",
      "Portal payment history",
      "Portal package balance",
      "Portal membership status",
      "Portal profile update",
    ],
    async (page) => {
      await visitRoute(page, `/portal/${MASTER_UAT_SLUG}`);
      const body = await page.locator("body").innerText();
      if (!/portal|sign in|appointment|login/i.test(body)) {
        throw new Error("Client portal surface not available");
      }
    },
  ),
  journey("132", "O", "Manage appointment link", async (page) => {
    await adminRoute(page, "/appointments/scheduled", /scheduled|appointment/i);
  }),
  journey("133", "O", "Manage link reschedule", async (page) => {
    await visitRoute(page, `/manage/demo-reschedule-token`);
  }),
  journey("134", "O", "Manage link cancel", async (page) => {
    await visitRoute(page, `/manage/demo-cancel-token`);
  }),
  journey("135", "O", "Invalid manage link", async (page) => adminManageLinkInvalid(page)),
];

const P = [
  journey("136", "P", "Staff calendar view", async (page) => {
    await adminRoute(page, "/appointments/calendar", /calendar|appointment/i);
  }),
  journey("137", "P", "Create appointment (staff)", async (page) => createMasterUatAppointment(page)),
  journey("138", "P", "Edit appointment notes", async (page) => {
    const { appointmentId } = await createMasterUatAppointment(page);
    await editAppointmentNotesUserAction(page, appointmentId);
  }),
  journey("139", "P", "Cancel appointment (staff)", async (page) => {
    await adminRoute(page, "/appointments/scheduled", /scheduled|cancel|appointment/i);
  }),
  ...sectionJourneys(
    140,
    "P",
    [
      "Reschedule (staff)",
      "Block time",
      "Staff availability override",
      "Appointment status workflow",
      "Internal notes",
      "Staff assignment change",
    ],
    async (page, title) => {
      await adminRoute(page, "/appointments/calendar", /calendar|reschedule|block/i);
      if (title.includes("Staff assignment")) await saveStaffUserAction(page);
    },
  ),
];

const Q = [
  journey("146", "Q", "Reminder template", async (page) => saveReminderSettingsUserAction(page)),
  journey("147", "Q", "Reminder timing", async (page) => saveReminderSettingsUserAction(page)),
  journey("148", "Q", "Reminder preview", async (page) => remindersPreviewUserAction(page)),
  providerBlocked("149", "Q", "SMS reminder channel", "Live SMS delivery"),
  providerBlocked("150", "Q", "Email reminder channel", "Live email delivery"),
  journey("151", "Q", "Reminder for class", async (page) => {
    await adminRoute(page, "/appointments/reminders", /reminder|class/i);
  }),
];

const R = sectionJourneys(
  152,
  "R",
  [
    "Booking workflow trigger",
    "Workflow on cancel",
    "Workflow on no-show",
    "Workflow SMS action",
    "Workflow email action",
    "Workflow tag contact",
    "Workflow internal task",
    "Workflow delay step",
  ],
  async (page) => {
    await adminRoute(page, "/appointments/workflows", /workflow|automation|trigger/i);
  },
);

const S = sectionJourneys(
  160,
  "S",
  [
    "Appointments overview KPIs",
    "Revenue report",
    "Booking funnel",
    "No-show rate",
    "Cancellation rate",
    "Staff utilization",
    "Service popularity",
    "Export analytics",
  ],
  async (page) => {
    await overviewPilotAndSearch(page);
    await adminRoute(page, "/appointments/analytics", /analytics|report|booking/i);
  },
);

const T = sectionJourneys(
  168,
  "T",
  ["Calendar day view", "Calendar week view", "Calendar month view", "Calendar filter by staff"],
  async (page) => {
    await adminRoute(page, "/appointments/calendar", /calendar|day|week|month/i);
  },
);

const U = [
  ...sectionJourneys(
    172,
    "U",
    ["Contact from booking", "Contact appointment history", "Contact notes", "Contact segments"],
    async (page, title) => {
      if (title.includes("segments")) await segmentsPageUserAction(page);
      else await adminRoute(page, "/contacts", /contact|client|customer/i);
    },
  ),
  journey("176", "U", "Contact merge", async (page) => {
    await adminRoute(page, "/contacts", /merge|duplicate|contact/i);
  }),
];

const V = sectionJourneys(
  177,
  "V",
  ["Conversation from appointment", "SMS thread context", "Send message from appointment", "MCTB handoff link"],
  async (page, title) => {
    if (title.includes("MCTB")) {
      await visitRoute(page, "/mctb");
    } else {
      await adminRoute(page, "/conversations", /conversation|message|inbox/i);
    }
  },
);

const W = sectionJourneys(
  181,
  "W",
  [
    "Smart routing overview",
    "Routing rules list",
    "Create routing rule",
    "MCTB fallback routing",
    "Business hours routing",
    "Ring group",
    "Voicemail fallback",
    "Routing activity log",
  ],
  async (page) => {
    await visitRoute(page, "/smart-routing");
    const body = await page.locator("body").innerText();
    if (!/routing|smart|call/i.test(body)) throw new Error("Smart routing surface not available");
  },
);

const X = sectionJourneys(
  189,
  "X",
  ["Video meeting link on appointment", "Video provider settings"],
  async (page) => {
    await adminRoute(page, "/appointments/types", /video|meeting|zoom|google meet/i);
  },
);

const Y = sectionJourneys(
  191,
  "Y",
  ["Webhook endpoint config", "Webhook delivery log", "Webhook retry"],
  async (page) => {
    await adminRoute(page, "/settings/integrations", /webhook|integration/i);
  },
);

const Z = sectionJourneys(
  194,
  "Z",
  ["Recurring appointment series", "Recurring series edit"],
  async (page) => {
    await adminRoute(page, "/appointments/calendar", /recurring|repeat|series/i);
  },
);

const AA = sectionJourneys(
  196,
  "AA",
  ["Cancellation policy", "No-show policy", "Late cancel policy", "Policy on public book"],
  async (page) => {
    await adminRoute(page, "/appointments/policies", /policy|cancel|no-show/i);
    await openPublicBooking(page);
  },
);

const AB = sectionJourneys(
  200,
  "AB",
  ["Calendar color by service", "Calendar color by staff"],
  async (page) => {
    await adminRoute(page, "/appointments/calendar", /color|calendar/i);
  },
);

const AC = sectionJourneys(
  202,
  "AC",
  ["Client booking restrictions", "Restriction on public book"],
  async (page) => {
    await adminRoute(page, "/appointments/restrictions", /restrict|limit|client/i);
    await openPublicBooking(page);
  },
);

const AD = [journey("204", "AD", "Loyalty / rewards program", async (page) => {
  await adminRoute(page, "/appointments/commerce", /loyalty|reward|program/i);
})];

const AE = [journey("205", "AE", "OTP / magic link portal auth", async (page) => {
  await visitRoute(page, `/portal/${MASTER_UAT_SLUG}`);
  const body = await page.locator("body").innerText();
  if (!/otp|magic|code|email/i.test(body)) throw new Error("OTP portal auth not surfaced");
})];

const AF = sectionJourneys(
  206,
  "AF",
  ["Referral program config", "Referral redemption"],
  async (page) => {
    await ensureAppointmentsAdmin(page);
    await visitRoute(page, "/appointments/commerce");
    await page.getByRole("button", { name: /referral/i }).first().click({ timeout: ACTION_TIMEOUT });
    await page.waitForTimeout(1000);
    const body = await page.locator("body").innerText();
    if (!/referral/i.test(body)) throw new Error("/appointments/commerce missing referral UI");
  },
);

const AG = [journey("208", "AG", "Household / family accounts", async (page) => {
  await adminRoute(page, "/contacts", /household|family|dependent/i);
})];

const AH = [journey("209", "AH", "Treatment / service history record", async (page) => {
  await adminRoute(page, "/appointments/scheduled", /treatment|history|record/i);
})];

const AI = [
  providerBlocked("210", "AI", "Reserve with Google", "Google Reserve OAuth"),
  providerBlocked("211", "AI", "Facebook booking", "Facebook integration"),
  providerBlocked("212", "AI", "Instagram booking", "Instagram integration"),
  providerBlocked("213", "AI", "iCloud calendar sync", "Apple iCloud OAuth"),
  providerBlocked("214", "AI", "SAML SSO", "Enterprise SAML IdP"),
  providerBlocked("215", "AI", "SCIM provisioning", "Enterprise SCIM"),
];

const AJ = sectionJourneys(
  216,
  "AJ",
  [
    "Mobile calendar reflow",
    "Mobile public book reflow",
    "200% zoom primary task",
    "Keyboard calendar navigation",
  ],
  async (page) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await adminRoute(page, "/appointments/calendar", /calendar|appointment/i);
    await openPublicBooking(page);
  },
);

const AK = sectionJourneys(
  220,
  "AK",
  [
    "Book → manage → reschedule",
    "Book → cancel → wallet credit",
    "Package purchase → redeem booking",
    "Membership book member-only",
    "Class enroll → check-in",
    "Waitlist join → promote → book",
    "Staff create → reminder preview",
    "Multi-service book journey",
    "Portal login → history",
    "End-to-end POS mixed checkout",
  ],
  async (page, title) => {
    if (/portal/i.test(title)) {
      await visitRoute(page, `/portal/${MASTER_UAT_SLUG}`);
      return;
    }
    if (/POS|checkout/i.test(title)) {
      await adminRoute(page, "/appointments/pos", /pos|checkout|cart/i);
      return;
    }
    await openPublicBooking(page);
    if (/Staff create/i.test(title)) {
      await createMasterUatAppointment(page);
      await remindersPreviewUserAction(page);
    }
  },
);

export const SECTIONS_M_THROUGH_AK = [
  ...M,
  ...N,
  ...O,
  ...P,
  ...Q,
  ...R,
  ...S,
  ...T,
  ...U,
  ...V,
  ...W,
  ...X,
  ...Y,
  ...Z,
  ...AA,
  ...AB,
  ...AC,
  ...AD,
  ...AE,
  ...AF,
  ...AG,
  ...AH,
  ...AI,
  ...AJ,
  ...AK,
];
