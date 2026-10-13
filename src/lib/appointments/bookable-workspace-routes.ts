/** Route base for service (bookable type) workspace — list, new, detail. */
export type ServicesWorkspaceRoutes = {
  list: string;
  new: string;
  detail: (id: string) => string;
  detailWithSection: (id: string, section: string) => string;
};

export const APPOINTMENTS_SERVICES_ROUTES: ServicesWorkspaceRoutes = {
  list: "/appointments/services",
  new: "/appointments/services/new",
  detail: (id) => `/appointments/services/${id}`,
  detailWithSection: (id, section) =>
    section === "overview"
      ? `/appointments/services/${id}`
      : `/appointments/services/${id}?section=${section}`,
};

export const AR_BOOKING_SERVICES_ROUTES: ServicesWorkspaceRoutes = {
  list: "/appointment-reminders/booking/services",
  new: "/appointment-reminders/booking/services/new",
  detail: (id) => `/appointment-reminders/booking/services/${id}`,
  detailWithSection: (id, section) =>
    section === "overview"
      ? `/appointment-reminders/booking/services/${id}`
      : `/appointment-reminders/booking/services/${id}?section=${section}`,
};

export type MeetingsWorkspaceRoutes = {
  list: string;
  new: string;
  detail: (id: string) => string;
  detailWithSection: (id: string, section: string) => string;
};

export const APPOINTMENTS_MEETINGS_ROUTES: MeetingsWorkspaceRoutes = {
  list: "/appointments/meetings",
  new: "/appointments/meetings/new",
  detail: (id) => `/appointments/meetings/${id}`,
  detailWithSection: (id, section) =>
    section === "overview"
      ? `/appointments/meetings/${id}`
      : `/appointments/meetings/${id}?section=${section}`,
};

export const AR_BOOKING_MEETINGS_ROUTES: MeetingsWorkspaceRoutes = {
  list: "/appointment-reminders/booking/meetings",
  new: "/appointment-reminders/booking/meetings/new",
  detail: (id) => `/appointment-reminders/booking/meetings/${id}`,
  detailWithSection: (id, section) =>
    section === "overview"
      ? `/appointment-reminders/booking/meetings/${id}`
      : `/appointment-reminders/booking/meetings/${id}?section=${section}`,
};

export type ClassesWorkspaceRoutes = MeetingsWorkspaceRoutes;

export const APPOINTMENTS_CLASSES_ROUTES: ClassesWorkspaceRoutes = {
  list: "/appointments/classes",
  new: "/appointments/classes/new",
  detail: (id) => `/appointments/classes/${id}`,
  detailWithSection: (id, section) =>
    section === "overview"
      ? `/appointments/classes/${id}`
      : `/appointments/classes/${id}?section=${section}`,
};

export type WorkshopsWorkspaceRoutes = MeetingsWorkspaceRoutes;

export const APPOINTMENTS_WORKSHOPS_ROUTES: WorkshopsWorkspaceRoutes = {
  list: "/appointments/workshops",
  new: "/appointments/workshops/new",
  detail: (id) => `/appointments/workshops/${id}`,
  detailWithSection: (id, section) =>
    section === "overview"
      ? `/appointments/workshops/${id}`
      : `/appointments/workshops/${id}?section=${section}`,
};
