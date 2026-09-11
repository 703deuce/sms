export type ServiceSectionId =
  | "overview"
  | "scheduling"
  | "staff-place"
  | "pricing-access"
  | "customer-setup"
  | "advanced";

export const SERVICE_SECTIONS: Array<{
  id: ServiceSectionId;
  label: string;
  description: string;
}> = [
  { id: "overview", label: "Overview", description: "Name, description, and status" },
  { id: "scheduling", label: "Scheduling", description: "Duration, buffers, and availability" },
  { id: "staff-place", label: "Staff & place", description: "Who provides it and where" },
  { id: "pricing-access", label: "Pricing & access", description: "Price and who can book" },
  { id: "customer-setup", label: "Customer setup", description: "Questions and intake forms" },
  { id: "advanced", label: "Advanced", description: "Add-ons, policies, confirmation" },
];
