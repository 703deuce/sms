/**
 * Preflight check for preview-only browser certification.
 * Verifies BROWSER_CERT_BASE_URL, deploy SHA provenance, and /api/health — no Chromium.
 */
import { browserCertPreflight } from "./browser-cert/lib";

browserCertPreflight().then((r) => {
  console.log(r.message);
  process.exit(r.ok ? 0 : 1);
});
