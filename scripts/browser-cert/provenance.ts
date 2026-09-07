import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { CERT_DIR } from "./lib";

export type BrowserCertProvenance = {
  recordedAt: string;
  certificationStartedAt: string;
  baseUrl: string;
  gitCommitSha: string;
  deployCommitSha: string;
  provenanceVerified: boolean;
};

const PROVENANCE_FILE = join(CERT_DIR, "appointments-mctb-browser-cert-provenance.json");

export function writeProvenance(provenance: BrowserCertProvenance) {
  mkdirSync(CERT_DIR, { recursive: true });
  writeFileSync(PROVENANCE_FILE, JSON.stringify(provenance, null, 2));
}

export function readProvenance(): BrowserCertProvenance | null {
  if (!existsSync(PROVENANCE_FILE)) return null;
  return JSON.parse(readFileSync(PROVENANCE_FILE, "utf8")) as BrowserCertProvenance;
}
