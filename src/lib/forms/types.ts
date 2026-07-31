export type FormFieldKey = "phone" | "firstName" | "lastName" | "email" | "dateOfBirth";

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
  ageGateMinAge?: number;
};

export const DEFAULT_FORM_FIELDS: FormFieldKey[] = ["firstName", "phone"];

export const FIELD_LABELS: Record<FormFieldKey, string> = {
  phone: "Mobile number",
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  dateOfBirth: "Date of birth",
};

export function parseFormConfig(raw: unknown): OptInFormConfig {
  if (!raw || typeof raw !== "object") return { fields: [...DEFAULT_FORM_FIELDS] };
  const obj = raw as OptInFormConfig;
  const fields = Array.isArray(obj.fields)
    ? obj.fields.filter((f): f is FormFieldKey =>
        f === "phone" ||
        f === "firstName" ||
        f === "lastName" ||
        f === "email" ||
        f === "dateOfBirth",
      )
    : [...DEFAULT_FORM_FIELDS];
  if (!fields.includes("phone")) fields.unshift("phone");
  const ageGateMinAge =
    typeof obj.ageGateMinAge === "number" && obj.ageGateMinAge >= 1 ? obj.ageGateMinAge : undefined;
  return {
    fields,
    branding: obj.branding,
    buttonLabel: obj.buttonLabel,
    headline: obj.headline,
    subheadline: obj.subheadline,
    ageGateMinAge,
  };
}

export const DEFAULT_DISCLOSURE =
  "By submitting, you agree to receive SMS from us. Msg & data rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of purchase.";

export function computeAgeFromDateOfBirth(dob: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const birth = new Date(year, month - 1, day);
  if (birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day) {
    return null;
  }
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const md = now.getMonth() - birth.getMonth();
  if (md < 0 || (md === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}
