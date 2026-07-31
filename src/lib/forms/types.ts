export type FormFieldKey = "phone" | "firstName" | "lastName" | "email";

export type FormBranding = {
  businessName?: string;
  primaryColor?: string;
  accentColor?: string;
  theme?: "light" | "dark";
  logoUrl?: string;
};

export type OptInFormConfig = {
  fields?: FormFieldKey[];
  branding?: FormBranding;
  buttonLabel?: string;
  headline?: string;
  subheadline?: string;
};

export const DEFAULT_FORM_FIELDS: FormFieldKey[] = ["firstName", "phone"];

export const FIELD_LABELS: Record<FormFieldKey, string> = {
  phone: "Mobile number",
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
};

export function parseFormConfig(raw: unknown): OptInFormConfig {
  if (!raw || typeof raw !== "object") return { fields: [...DEFAULT_FORM_FIELDS] };
  const obj = raw as OptInFormConfig;
  const fields = Array.isArray(obj.fields)
    ? obj.fields.filter((f): f is FormFieldKey =>
        f === "phone" || f === "firstName" || f === "lastName" || f === "email",
      )
    : [...DEFAULT_FORM_FIELDS];
  if (!fields.includes("phone")) fields.unshift("phone");
  return {
    fields,
    branding: obj.branding,
    buttonLabel: obj.buttonLabel,
    headline: obj.headline,
    subheadline: obj.subheadline,
  };
}

export const DEFAULT_DISCLOSURE =
  "By submitting, you agree to receive SMS from us. Msg & data rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of purchase.";
