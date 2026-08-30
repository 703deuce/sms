import type { MctbTexmlCertMode } from "./constants";

export function resolveMctbTexmlCertMode(): MctbTexmlCertMode {
  const raw = (process.env.MCTB_TEXML_CERT_MODE || "D").trim().toUpperCase();
  if (raw === "A" || raw === "B" || raw === "C") return raw;
  return "D";
}

export function certModeSkipsSms(): boolean {
  return resolveMctbTexmlCertMode() === "A" || resolveMctbTexmlCertMode() === "B";
}

export function certModeSkipsConsentBackend(): boolean {
  return resolveMctbTexmlCertMode() === "A" || resolveMctbTexmlCertMode() === "B";
}

export function certModeUsesTestSms(): boolean {
  return resolveMctbTexmlCertMode() === "C";
}
