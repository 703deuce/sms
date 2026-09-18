import type { IntakeRequirementLevel } from "./types";
import type { BuiltinIntakeFieldKey } from "./wizard-config";

export const INTAKE_FIELD_DEFAULTS: Record<
  BuiltinIntakeFieldKey,
  { label: string; questionText: string; requirementLevel: IntakeRequirementLevel; enabled: boolean }
> = {
  name: {
    label: "Name",
    questionText: "May I have your name?",
    requirementLevel: "REQUIRED_BEFORE_BOOKING",
    enabled: true,
  },
  email: {
    label: "Email",
    questionText: "What's the best email for you?",
    requirementLevel: "REQUIRED_FOR_RECORD",
    enabled: true,
  },
  phone: {
    label: "Phone",
    questionText: "What number can we reach you at?",
    requirementLevel: "OPTIONAL",
    enabled: true,
  },
  address: {
    label: "Address",
    questionText: "What's the service address?",
    requirementLevel: "OPTIONAL",
    enabled: false,
  },
  service_reason: {
    label: "Service",
    questionText: "What do you need help with today?",
    requirementLevel: "REQUIRED_BEFORE_BOOKING",
    enabled: true,
  },
};
