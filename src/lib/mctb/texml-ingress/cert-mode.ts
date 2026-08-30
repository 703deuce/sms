import type { MctbTexmlCertMode } from "./constants";

export function resolveMctbTexmlCertMode(): MctbTexmlCertMode | "MINIMAL" {
  const raw = (process.env.MCTB_TEXML_CERT_MODE || "MINIMAL").trim().toUpperCase();
  if (raw === "MINIMAL" || raw === "0") return "MINIMAL";
  if (raw === "A" || raw === "B" || raw === "C") return raw;
  return "D";
}

export function isMinimalCertMode(mode?: string): boolean {
  const m = mode || resolveMctbTexmlCertMode();
  return m === "MINIMAL" || m === "A";
}

export function certModeSkipsSms(): boolean {
  const m = resolveMctbTexmlCertMode();
  return m === "MINIMAL" || m === "A" || m === "B";
}

export function certModeSkipsConsentBackend(): boolean {
  const m = resolveMctbTexmlCertMode();
  return m === "MINIMAL" || m === "A" || m === "B";
}

export function certModeUsesTestSms(): boolean {
  return resolveMctbTexmlCertMode() === "C";
}
