import type { MctbTexmlCertMode } from "./constants";

export type ResolvedMctbTexmlCertMode = MctbTexmlCertMode | "MINIMAL";

/** cert from ?cert= on voice_url (Telnyx) wins over env; default D = production. */
export function resolveMctbTexmlCertMode(override?: string | null): ResolvedMctbTexmlCertMode {
  const raw = (override?.trim() || process.env.MCTB_TEXML_CERT_MODE?.trim() || "D")
    .toUpperCase();
  if (raw === "MINIMAL" || raw === "0") return "MINIMAL";
  if (raw === "A" || raw === "B" || raw === "C") return raw;
  return "D";
}

export function isMinimalCertMode(mode?: ResolvedMctbTexmlCertMode): boolean {
  const m = mode ?? resolveMctbTexmlCertMode();
  return m === "MINIMAL" || m === "A";
}

export function certModeForcesPress1Gather(mode?: ResolvedMctbTexmlCertMode): boolean {
  const m = mode ?? resolveMctbTexmlCertMode();
  return m === "B" || m === "C";
}

export function certModeSkipsSms(mode?: ResolvedMctbTexmlCertMode): boolean {
  const m = mode ?? resolveMctbTexmlCertMode();
  return m === "MINIMAL" || m === "A" || m === "B";
}

export function certModeSkipsConsentBackend(mode?: ResolvedMctbTexmlCertMode): boolean {
  const m = mode ?? resolveMctbTexmlCertMode();
  return m === "MINIMAL" || m === "A" || m === "B";
}

export function certModeUsesTestSms(mode?: ResolvedMctbTexmlCertMode): boolean {
  const m = mode ?? resolveMctbTexmlCertMode();
  return m === "C";
}

export function mctbEntryVoiceUrlWithCert(baseEntryUrl: string, cert?: string | null): string {
  const mode = resolveMctbTexmlCertMode(cert);
  if (mode === "D") return baseEntryUrl.replace(/\/$/, "");
  const url = new URL(baseEntryUrl);
  url.searchParams.set("cert", mode === "MINIMAL" ? "A" : mode);
  return url.toString();
}
