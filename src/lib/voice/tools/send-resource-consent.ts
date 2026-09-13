/**
 * SMS consent gate for send_resource — no server-only imports (testable from scripts).
 */
export function sendResourceConsentAllowed(input: {
  resourceType: string;
  priorConsent: boolean;
  verbalSmsConsent?: boolean;
  afterHoursProfile?: boolean;
}): boolean {
  if (input.priorConsent || input.verbalSmsConsent === true) return true;
  if (input.verbalSmsConsent === false) return false;
  // After-hours: never trust workflow node alone — explicit yes or prior consent on file.
  if (input.afterHoursProfile) return false;
  // Business-hours workflow: ACTION node implies consent; model often omits verbal_sms_consent.
  return input.resourceType === "booking";
}
