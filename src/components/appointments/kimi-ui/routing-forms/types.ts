export type RoutingFormField = {
  id: string;
  label: string;
  type: "text" | "email" | "phone" | "select" | "number" | "company_size" | "industry";
  required?: boolean;
  options?: string[];
};

export type RoutingDestination = {
  appointmentTypeId?: string;
  staffId?: string;
  schedulingGroupId?: string;
  externalUrl?: string;
};

export type RoutingFormRule = {
  id: string;
  priority?: number;
  logic?: "and" | "or";
  conditions: Array<{
    fieldId: string;
    operator: "equals" | "contains" | "gt" | "lt" | "in";
    value: string;
  }>;
  destination: RoutingDestination;
  fallback?: boolean;
};

export type RoutingForm = {
  id: string;
  name: string;
  slug: string;
  active?: boolean;
  headline?: string;
  fields: RoutingFormField[];
  rules: RoutingFormRule[];
  fallbackDestination?: RoutingDestination;
};

export const industryOptions = [
  "Healthcare",
  "Legal",
  "Real Estate",
  "Financial Services",
  "Home Services",
  "Professional Services",
  "Education",
  "Other",
];

export const companySizeOptions = ["1-10", "11-50", "51-200", "201-1000", "1000+"];

export const bookingTypes = [
  { id: "type_consult", name: "Initial Consultation" },
  { id: "type_demo", name: "Product Demo" },
  { id: "type_followup", name: "Follow-up Call" },
  { id: "type_enterprise", name: "Enterprise Discovery" },
];

export const staffMembers = [
  { id: "staff_sarah", name: "Sarah Johnson" },
  { id: "staff_mike", name: "Mike Chen" },
  { id: "staff_ana", name: "Ana Rodriguez" },
];

export const initialForms: RoutingForm[] = [
  {
    id: "rf_1",
    name: "Website lead intake",
    slug: "lead-intake",
    active: true,
    headline: "How can we help you?",
    fields: [
      { id: "industry", label: "Industry", type: "select", required: true, options: industryOptions },
      { id: "company_size", label: "Company size", type: "select", required: true, options: companySizeOptions },
    ],
    rules: [
      {
        id: "rule_1",
        priority: 1,
        logic: "and",
        conditions: [{ fieldId: "industry", operator: "equals", value: "Healthcare" }],
        destination: { appointmentTypeId: "type_consult" },
      },
      {
        id: "rule_2",
        priority: 2,
        logic: "and",
        conditions: [{ fieldId: "company_size", operator: "equals", value: "1000+" }],
        destination: { staffId: "staff_sarah" },
      },
    ],
    fallbackDestination: { appointmentTypeId: "type_demo" },
  },
  {
    id: "rf_2",
    name: "Sales qualification",
    slug: "sales-qualification",
    active: false,
    headline: "Tell us about your team",
    fields: [
      { id: "company_size", label: "Company size", type: "select", required: true, options: companySizeOptions },
      { id: "role", label: "Your role", type: "text", required: false },
    ],
    rules: [
      {
        id: "rule_3",
        priority: 1,
        logic: "and",
        conditions: [{ fieldId: "company_size", operator: "equals", value: "201-1000" }],
        destination: { appointmentTypeId: "type_enterprise" },
      },
    ],
    fallbackDestination: { externalUrl: "" },
  },
];

export const routingAnalytics: Record<string, { views: number; routes: Record<string, number> }> = {
  rf_1: { views: 184, routes: { rule_1: 62, rule_2: 18, fallback: 41 } },
  rf_2: { views: 37, routes: { rule_3: 9, fallback: 12 } },
};
