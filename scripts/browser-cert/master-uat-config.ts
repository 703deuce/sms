/** Master Appointments browser UAT — harbor-home workspace (production cert). */
export const MASTER_UAT_SLUG = process.env.MASTER_UAT_WORKSPACE_SLUG?.trim() || "harbor-home";

const HARBOR_HOME_EMAIL = "alex@harborhome.co";
const HARBOR_HOME_PASSWORD = "demo1234";

/** Harbor-home owner — master UAT always uses this workspace; never cert accounts. */
export function getMasterUatCredentials() {
  const fromEnv = process.env.MASTER_UAT_EMAIL?.trim();
  const fromPassword = process.env.MASTER_UAT_PASSWORD?.trim();
  const email =
    fromEnv &&
    !fromEnv.includes("appt-mctb-browser") &&
    !fromEnv.includes("transovo.test") &&
    !fromEnv.includes("CERT_BROWSER")
      ? fromEnv
      : HARBOR_HOME_EMAIL;
  const password = fromPassword && fromPassword.length > 0 ? fromPassword : HARBOR_HOME_PASSWORD;
  return { email, password };
}

export const MASTER_UAT_SERVICE_NAME =
  process.env.MASTER_UAT_SERVICE_NAME?.trim() || "Browser Cert Consultation";

/** Full user journeys need longer than reachability smokes. */
export const MASTER_UAT_FLOW_TIMEOUT_MS = Number(process.env.MASTER_UAT_FLOW_TIMEOUT_MS || 180_000);
