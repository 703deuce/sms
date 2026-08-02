/**
 * Single list of providers operators should see and connect in the UI.
 * Mailchimp is intentionally excluded for this live pass.
 */

export type ConnectableProviderCard = {
  id: string;
  name: string;
  description: string;
  category: string;
  authKind: "oauth" | "credentials";
  /** Where Configure / Connect opens. */
  href: string;
  framework: "crm" | "native";
};

export const CONNECTABLE_PROVIDERS: ConnectableProviderCard[] = [
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Contacts, leads, accounts, opportunities, tasks — CRM OAuth.",
    category: "CRM",
    authKind: "oauth",
    href: "/integrations/crm/salesforce",
    framework: "crm",
  },
  {
    id: "zoho",
    name: "Zoho CRM",
    description: "Contacts, leads, accounts, deals, tasks — CRM OAuth.",
    category: "CRM",
    authKind: "oauth",
    href: "/integrations/crm/zoho",
    framework: "crm",
  },
  {
    id: "pipedrive",
    name: "Pipedrive",
    description: "Persons, orgs, deals, activities — CRM OAuth.",
    category: "CRM",
    authKind: "oauth",
    href: "/integrations/crm/pipedrive",
    framework: "crm",
  },
  {
    id: "calendly",
    name: "Calendly",
    description: "Appointments and invitees for reminders and call context.",
    category: "Scheduling & forms",
    authKind: "oauth",
    href: "/integrations/native/calendly",
    framework: "native",
  },
  {
    id: "typeform",
    name: "Typeform",
    description: "Form responses for lead capture and contact mapping.",
    category: "Scheduling & forms",
    authKind: "oauth",
    href: "/integrations/native/typeform",
    framework: "native",
  },
  {
    id: "jotform",
    name: "Jotform",
    description: "Forms and submissions via API key.",
    category: "Scheduling & forms",
    authKind: "credentials",
    href: "/integrations/native/jotform",
    framework: "native",
  },
  {
    id: "activecampaign",
    name: "ActiveCampaign",
    description: "Contacts, lists, tags, and deals via API URL + key.",
    category: "Marketing & sales",
    authKind: "credentials",
    href: "/integrations/native/activecampaign",
    framework: "native",
  },
  {
    id: "klaviyo",
    name: "Klaviyo",
    description: "Profiles and lists via scoped private API key.",
    category: "Marketing & sales",
    authKind: "credentials",
    href: "/integrations/native/klaviyo",
    framework: "native",
  },
  {
    id: "close",
    name: "Close",
    description: "Leads, contacts, opportunities, and tasks via API key.",
    category: "Marketing & sales",
    authKind: "credentials",
    href: "/integrations/native/close",
    framework: "native",
  },
  {
    id: "highlevel",
    name: "HighLevel",
    description: "Private Integration Token for one location.",
    category: "Marketing & sales",
    authKind: "credentials",
    href: "/integrations/native/highlevel",
    framework: "native",
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    description: "Customers and orders via store REST keys.",
    category: "Commerce & support",
    authKind: "credentials",
    href: "/integrations/native/woocommerce",
    framework: "native",
  },
  {
    id: "freshdesk",
    name: "Freshdesk",
    description: "Tickets and contacts via subdomain + API key.",
    category: "Commerce & support",
    authKind: "credentials",
    href: "/integrations/native/freshdesk",
    framework: "native",
  },
];

export const CONNECTABLE_CATEGORY_ORDER = [
  "CRM",
  "Scheduling & forms",
  "Marketing & sales",
  "Commerce & support",
];
