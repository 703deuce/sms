import { request } from "playwright";
import type { BrowserContext } from "playwright";
import { getMasterUatCredentials } from "./master-uat-config";

/**
 * Authenticate as harbor-home owner — never the appt-mctb-browser cert account.
 * CERT_BROWSER_PASSWORD is ignored for master UAT.
 */
export async function authenticateMasterUat(baseUrl: string): Promise<{
  ok: boolean;
  storageState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  email: string;
}> {
  const api = await request.newContext({
    baseURL: baseUrl,
    timeout: Number(process.env.BROWSER_CERT_API_TIMEOUT_MS || 120_000),
  });

  const useDevBypass =
    process.env.DEV_AUTH_BYPASS?.trim() === "1" ||
    process.env.DEV_AUTH_BYPASS?.trim()?.toLowerCase() === "true";

  if (useDevBypass) {
    const email = getMasterUatCredentials().email;
    const bypass = await api.get(
      `/api/auth/dev-bypass?next=/appointments/overview&email=${encodeURIComponent(email)}`,
      { maxRedirects: 0 },
    );
    if (bypass.ok() || [302, 307, 308].includes(bypass.status())) {
      const storageState = await api.storageState();
      await api.dispose();
      return { ok: true, storageState, email };
    }
  }

  const { email: loginEmail, password: loginPassword } = getMasterUatCredentials();
  if (!loginPassword) {
    await api.dispose();
    return { ok: false, storageState: await api.storageState(), email: loginEmail };
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const login = await api.post("/api/auth/login", {
      data: { email: loginEmail, password: loginPassword, next: "/appointments/overview" },
    });
    const loginBody = await login.json().catch(() => ({}));
    if (login.ok() && !loginBody.error) {
      const storageState = await api.storageState();
      await api.dispose();
      return { ok: true, storageState, email: loginEmail };
    }
    if (attempt < 1) await new Promise((r) => setTimeout(r, 3000));
  }

  await api.dispose();
  return { ok: false, storageState: { cookies: [], origins: [] }, email: loginEmail };
}
