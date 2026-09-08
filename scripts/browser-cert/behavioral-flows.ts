/**
 * True user-action acceptance flows (BATCH-UA).
 * These supplement reachability flows — they do not replace them.
 */
import type { Page } from "playwright";
import type { BrowserFlow } from "./flows";
import {
  cancelAppointmentUserAction,
  createAppointmentUserAction,
  createBookingTypeUserAction,
  editAppointmentNotesUserAction,
  publicBookingUserAction,
  saveAvailabilityUserAction,
  saveMctbConsentUserAction,
  saveMctbNotificationsUserAction,
  saveMctbPhoneUserAction,
  saveMctbTextBackUserAction,
  saveNotetakerSettingsUserAction,
  saveReminderSettingsUserAction,
} from "./behavioral-flow-helpers";

const UA = "BATCH-UA";

export const USER_ACTION_FLOWS: BrowserFlow[] = [
  {
    id: "UA-APT-05-create",
    batchId: UA,
    title: "Create appointment through UI",
    tier: "user-action",
    run: async (page) => {
      await createAppointmentUserAction(page);
    },
  },
  {
    id: "UA-APT-07-edit",
    batchId: UA,
    title: "Edit appointment notes and verify persistence",
    tier: "user-action",
    run: async (page) => {
      const { appointmentId } = await createAppointmentUserAction(page);
      await editAppointmentNotesUserAction(page, appointmentId);
    },
  },
  {
    id: "UA-APT-09-cancel",
    batchId: UA,
    title: "Cancel appointment through UI",
    tier: "user-action",
    run: async (page) => {
      const { appointmentId } = await createAppointmentUserAction(page);
      await cancelAppointmentUserAction(page, appointmentId);
    },
  },
  {
    id: "UA-APT-11-types",
    batchId: UA,
    title: "Create booking type and verify persistence",
    tier: "user-action",
    run: async (page) => {
      await createBookingTypeUserAction(page);
    },
  },
  {
    id: "UA-APT-16-availability",
    batchId: UA,
    title: "Change availability hours and verify persistence",
    tier: "user-action",
    run: async (page) => {
      await saveAvailabilityUserAction(page);
    },
  },
  {
    id: "UA-APT-33-reminders",
    batchId: UA,
    title: "Edit reminder template and verify persistence",
    tier: "user-action",
    run: async (page) => {
      await saveReminderSettingsUserAction(page);
    },
  },
  {
    id: "UA-APT-50-notetaker",
    batchId: UA,
    title: "Change AI Notetaker setting and verify persistence",
    tier: "user-action",
    run: async (page) => {
      await saveNotetakerSettingsUserAction(page);
    },
  },
  {
    id: "UA-APT-13-public-book",
    batchId: UA,
    title: "Complete public booking through UI",
    tier: "user-action",
    run: async (page) => {
      await publicBookingUserAction(page);
    },
  },
  {
    id: "UA-MCTB-05-phone",
    batchId: UA,
    title: "MCTB Phone & Forwarding save and reload",
    tier: "user-action",
    run: async (page) => {
      await saveMctbPhoneUserAction(page);
    },
  },
  {
    id: "UA-MCTB-07-consent",
    batchId: UA,
    title: "MCTB Consent mode save and reload",
    tier: "user-action",
    run: async (page) => {
      await saveMctbConsentUserAction(page);
    },
  },
  {
    id: "UA-MCTB-12-textback",
    batchId: UA,
    title: "MCTB Text Back opener save and reload",
    tier: "user-action",
    run: async (page) => {
      await saveMctbTextBackUserAction(page);
    },
  },
  {
    id: "UA-MCTB-41-notifications",
    batchId: UA,
    title: "MCTB Notifications & Handoff save and reload",
    tier: "user-action",
    run: async (page) => {
      await saveMctbNotificationsUserAction(page);
    },
  },
];

export const USER_ACTION_BATCH = {
  id: UA,
  title: "User-action acceptance (click/type/save/reload)",
} as const;
