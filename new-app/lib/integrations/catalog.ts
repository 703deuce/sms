export type IntegrationCatalogItem = {
  id: string;
  name: string;
  category: "Calendar" | "CRM" | "Payments";
  detail: string;
  impacts: string[];
  /** integrationConnection provider id, or special key */
  connectionProvider?: string;
  calendarProvider?: "google" | "microsoft";
  crmProvider?: "zoho" | "pipedrive" | "salesforce";
  paymentProvider?: "stripe";
};

export const INTEGRATION_CATALOG: IntegrationCatalogItem[] = [
  {
    id: "google-calendar",
    name: "Google Calendar",
    category: "Calendar",
    detail: "Connect Google for AI receptionist booking and availability.",
    impacts: ["AI booking", "Availability"],
    calendarProvider: "google",
  },
  {
    id: "microsoft-365",
    name: "Microsoft 365 Calendar",
    category: "Calendar",
    detail: "Connect Outlook / Microsoft 365 calendars.",
    impacts: ["AI booking", "Availability"],
    calendarProvider: "microsoft",
  },
  {
    id: "zoho",
    name: "Zoho CRM",
    category: "CRM",
    detail: "Sync contacts and log call activity to Zoho.",
    impacts: ["Lead sync", "Contact sync"],
    connectionProvider: "zoho",
    crmProvider: "zoho",
  },
  {
    id: "pipedrive",
    name: "Pipedrive",
    category: "CRM",
    detail: "Sync contacts and deals with Pipedrive.",
    impacts: ["Lead sync", "Pipeline"],
    connectionProvider: "pipedrive",
    crmProvider: "pipedrive",
  },
  {
    id: "salesforce",
    name: "Salesforce",
    category: "CRM",
    detail: "Connect Salesforce for contact sync.",
    impacts: ["Lead sync", "CRM records"],
    connectionProvider: "salesforce",
    crmProvider: "salesforce",
  },
  {
    id: "stripe",
    name: "Stripe",
    category: "Payments",
    detail: "Accept payments for appointments and services.",
    impacts: ["Payments", "Deposits"],
    paymentProvider: "stripe",
  },
];
