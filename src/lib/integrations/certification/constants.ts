import type { CertProviderId } from "./types";

/** Default certification workspace — never create a fake workspace unless explicitly requested. */
export const DEFAULT_CERT_WORKSPACE_ID = "ws_1";

export const CERT_WORKSPACE_ENV = "CERT_WORKSPACE_ID";

export function resolveCertWorkspaceId(explicit?: string | null): string {
  const fromEnv = process.env[CERT_WORKSPACE_ENV]?.trim();
  if (explicit?.trim()) return explicit.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_CERT_WORKSPACE_ID;
}

/** Priority providers for V1 integration certification matrix. */
export const CERT_PRIORITY_PROVIDERS: CertProviderId[] = [
  "pipedrive",
  "calendly",
  "zoho",
  "salesforce",
  "jotform",
];

export function certObjectLabel(kind: string, certRunId: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const short = certRunId.replace(/^cert_/, "").slice(0, 8);
  return `[TRANSOVO CERT] ${kind} ${stamp}-${short}`;
}
