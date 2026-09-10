/** Client-safe routing form presets (no server-only imports). */

import type { RoutingForm } from "@/lib/appointments/scheduling-capabilities";

export function presetIndustryOptions(): string[] {
  return [
    "Healthcare",
    "Legal",
    "Real Estate",
    "Financial Services",
    "Home Services",
    "Professional Services",
    "Education",
    "Other",
  ];
}

export function presetCompanySizeOptions(): string[] {
  return ["1-10", "11-50", "51-200", "201-1000", "1000+"];
}

export type RoutingFormPreset = {
  id: string;
  name: string;
  description: string;
  form: Omit<RoutingForm, "id">;
};

export function listRoutingFormPresets(): RoutingFormPreset[] {
  return [
    {
      id: "route_by_service",
      name: "Route by service",
      description: "Ask what type of help they need and send them to the right service.",
      form: {
        name: "Service routing",
        slug: "service-routing",
        active: false,
        headline: "What type of help do you need?",
        fields: [
          {
            id: "service_interest",
            label: "What are you looking for?",
            type: "select",
            required: true,
            options: ["Consultation", "Follow-up", "Group class", "Other"],
          },
        ],
        rules: [
          {
            id: "rule_consult",
            priority: 1,
            logic: "and",
            conditions: [{ fieldId: "service_interest", operator: "equals", value: "Consultation" }],
            destination: {},
          },
        ],
        fallbackDestination: {},
      },
    },
    {
      id: "route_by_location",
      name: "Route by location",
      description: "Match customers to the closest location before booking.",
      form: {
        name: "Location routing",
        slug: "location-routing",
        active: false,
        headline: "Which location works best for you?",
        fields: [
          {
            id: "preferred_location",
            label: "Preferred location",
            type: "select",
            required: true,
            options: ["Main office", "Downtown", "Virtual"],
          },
        ],
        rules: [],
        fallbackDestination: {},
      },
    },
    {
      id: "new_client_intake",
      name: "New client intake routing",
      description: "Qualify new clients with industry and company size before booking.",
      form: {
        name: "New client routing",
        slug: "new-client-routing",
        active: false,
        headline: "Tell us a little about your business",
        fields: [
          { id: "industry", label: "Industry", type: "select", required: true, options: presetIndustryOptions() },
          { id: "company_size", label: "Company size", type: "select", required: true, options: presetCompanySizeOptions() },
        ],
        rules: [
          {
            id: "rule_enterprise",
            priority: 1,
            logic: "and",
            conditions: [{ fieldId: "company_size", operator: "equals", value: "1000+" }],
            destination: {},
          },
        ],
        fallbackDestination: {},
      },
    },
  ];
}
