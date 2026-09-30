import type { BrowserContext } from "playwright";

export async function authenticateMctbProd(
  context: BrowserContext,
  base: string,
  workspaceId: string,
  email: string,
): Promise<void> {
  if (!email) throw new Error("Set MCTB_PROD_CERT_EMAIL or ADMIN_EMAILS");
  const page = await context.newPage();
  await page.goto(
    `${base}/api/auth/dev-bypass?next=${encodeURIComponent("/mctb")}&email=${encodeURIComponent(email)}`,
    { waitUntil: "domcontentloaded", timeout: 120_000 },
  );
  await page.waitForURL(/\/mctb/, { timeout: 120_000 }).catch(() => undefined);
  const api = await context.request.post(`${base}/api/workspace`, {
    data: { workspaceId },
  });
  if (!api.ok()) {
    const body = await api.text();
    throw new Error(`Workspace switch failed: ${api.status()} ${body}`);
  }
  await page.close();
}

export async function healthSha(base: string): Promise<string> {
  const res = await fetch(`${base}/api/health`);
  const j = (await res.json()) as { commitSha?: string; ok?: boolean };
  if (!j.ok) throw new Error(`Health not ok: ${JSON.stringify(j)}`);
  return j.commitSha || "unknown";
}
