export type WaitlistEntry = {
  id: string;
  serviceName: string | null;
  phone: string | null;
  email: string | null;
  preferredDate?: string | null;
  status: "active" | "notified" | "accepted" | "expired" | "removed";
  createdAt: string;
  notifiedAt?: string | null;
};

export const WAITLIST_ENTRIES: WaitlistEntry[] = [
  {
    id: "wl_01",
    serviceName: "Water Heater Estimate",
    phone: "+15714073615",
    email: "sarah.johnson@example.com",
    preferredDate: "Fri, Sep 12",
    status: "active",
    createdAt: "2026-09-05T14:22:00Z",
  },
  {
    id: "wl_02",
    serviceName: "Initial Consultation",
    phone: "+17035550192",
    email: "marcus.lee@example.com",
    preferredDate: "Mon, Sep 8",
    status: "active",
    createdAt: "2026-09-06T09:10:00Z",
  },
  {
    id: "wl_03",
    serviceName: null,
    phone: "+12025558741",
    email: null,
    preferredDate: null,
    status: "notified",
    createdAt: "2026-09-03T17:45:00Z",
    notifiedAt: "2026-09-07T13:02:00Z",
  },
  {
    id: "wl_04",
    serviceName: "Annual HVAC Tune-Up",
    phone: null,
    email: "priya.nair@example.com",
    preferredDate: "Week of Sep 15",
    status: "notified",
    createdAt: "2026-09-02T11:30:00Z",
    notifiedAt: "2026-09-06T15:40:00Z",
  },
  {
    id: "wl_05",
    serviceName: "Water Heater Estimate",
    phone: "+13015552208",
    email: "dan.okafor@example.com",
    preferredDate: "Thu, Sep 11",
    status: "accepted",
    createdAt: "2026-08-29T10:05:00Z",
    notifiedAt: "2026-09-04T09:12:00Z",
  },
  {
    id: "wl_06",
    serviceName: "Follow-Up Visit",
    phone: "+15715559344",
    email: "elena.rodriguez@example.com",
    preferredDate: null,
    status: "expired",
    createdAt: "2026-08-24T16:18:00Z",
    notifiedAt: "2026-08-30T10:00:00Z",
  },
  {
    id: "wl_07",
    serviceName: "Initial Consultation",
    phone: "+17145550067",
    email: null,
    preferredDate: "Tue, Sep 9",
    status: "active",
    createdAt: "2026-09-07T08:52:00Z",
  },
  {
    id: "wl_08",
    serviceName: "Water Heater Estimate",
    phone: "+18435550118",
    email: "tom.baker@example.com",
    preferredDate: null,
    status: "removed",
    createdAt: "2026-08-20T12:40:00Z",
    notifiedAt: "2026-08-25T09:30:00Z",
  },
];
