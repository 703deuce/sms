/** Client-safe request-form types and defaults (no Node/crypto/DB). */

export type MctbRequestFormField = {
  id: string;
  label: string;
  type: "text" | "email" | "phone" | "textarea";
  required?: boolean;
  placeholder?: string;
};

export const DEFAULT_MCTB_REQUEST_FORM_FIELDS: MctbRequestFormField[] = [
  { id: "name", label: "Your name", type: "text", required: true },
  { id: "phone", label: "Phone number", type: "phone", required: true },
  { id: "message", label: "How can we help?", type: "textarea", required: false },
];

export function mctbRequestFormPublicPath(token: string): string {
  return `/f/mctb/${encodeURIComponent(token)}`;
}
