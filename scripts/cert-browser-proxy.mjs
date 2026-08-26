/**
 * Local-only login around for Mass Texting browser cert.
 * Proxies the running Next server and issues a session via smoke-login
 * when GET /__cert_login?token=... is hit.
 *
 * Usage:
 *   CERT_BROWSER_LOGIN_TOKEN=transovo-smoke-bootstrap-b56f-aug2026 \
 *     node scripts/cert-browser-proxy.mjs
 */
import http from "node:http";

const TARGET_PORT = Number(process.env.CERT_PROXY_TARGET || 3000);
const LISTEN_PORT = Number(process.env.CERT_PROXY_PORT || 3001);
const TOKEN =
  process.env.CERT_BROWSER_LOGIN_TOKEN || "transovo-smoke-bootstrap-b56f-aug2026";
const EMAIL = (process.env.CERT_BROWSER_EMAIL || "mt-cert-browser@transovo.test").toLowerCase();
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const TARGET = `http://127.0.0.1:${TARGET_PORT}`;

function cookieHeader(setCookies) {
  return setCookies.map((c) => c.split(";")[0]).join("; ");
}

async function certLogin(url, res) {
  const token = url.searchParams.get("token") || "";
  if (token !== TOKEN) {
    res.writeHead(401, { "content-type": "text/plain" });
    res.end("Unauthorized");
    return;
  }

  const loginRes = await fetch(`${TARGET}/api/auth/smoke-login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    body: JSON.stringify({
      email: url.searchParams.get("email") || EMAIL,
      workspaceId: url.searchParams.get("workspaceId") || undefined,
    }),
  });
  const loginJson = await loginRes.json().catch(() => ({}));
  if (!loginRes.ok) {
    res.writeHead(loginRes.status, { "content-type": "application/json" });
    res.end(JSON.stringify(loginJson));
    return;
  }

  const cookies = [...(loginRes.headers.getSetCookie?.() || [])];
  const openRes = await fetch(
    `${TARGET}/api/products/open?product=mass_texting&next=/sms`,
    {
      method: "GET",
      redirect: "manual",
      headers: { cookie: cookieHeader(cookies) },
    },
  );
  cookies.push(...(openRes.headers.getSetCookie?.() || []));

  const next = url.searchParams.get("next") || "/sms";
  const location = next.startsWith("/") && !next.startsWith("//") ? next : "/sms";
  res.writeHead(302, {
    Location: location,
    "Set-Cookie": cookies,
  });
  res.end();
}

function proxy(req, res) {
  const headers = { ...req.headers, host: `127.0.0.1:${TARGET_PORT}` };
  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port: TARGET_PORT,
      path: req.url,
      method: req.method,
      headers,
    },
    (up) => {
      res.writeHead(up.statusCode || 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", (err) => {
    res.writeHead(502, { "content-type": "text/plain" });
    res.end(`proxy error: ${err.message}`);
  });
  req.pipe(upstream);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${LISTEN_PORT}`);
  if (url.pathname === "/__cert_login") {
    try {
      await certLogin(url, res);
    } catch (err) {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end(err instanceof Error ? err.message : "cert login failed");
    }
    return;
  }
  proxy(req, res);
});

server.listen(LISTEN_PORT, "127.0.0.1", () => {
  console.log(
    `cert-browser-proxy listening on http://127.0.0.1:${LISTEN_PORT} → :${TARGET_PORT}`,
  );
  console.log(
    `login: http://127.0.0.1:${LISTEN_PORT}/__cert_login?token=${TOKEN}&next=/sms`,
  );
});
