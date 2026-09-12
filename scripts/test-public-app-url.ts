import assert from "node:assert/strict";
import {
  getIntegrationAppUrl,
  publicRedirectUrl,
  resolvePublicAppUrl,
} from "@/lib/integrations/framework/app-url";

const prevAppUrl = process.env.APP_URL;
const prevPublic = process.env.NEXT_PUBLIC_APP_URL;
const prevNodeEnv = process.env.NODE_ENV;

process.env.APP_URL = "https://0.0.0.0:3000"; // pragma: allowlist secret
process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
process.env.NODE_ENV = "production";

assert.equal(resolvePublicAppUrl(), "https://app.example.com");
assert.equal(getIntegrationAppUrl(), "https://app.example.com");

const internalRequest = new Request("http://0.0.0.0:3000/api/products/open?product=voice", {
  headers: {
    host: "0.0.0.0:3000",
    "x-forwarded-host": "app.example.com",
    "x-forwarded-proto": "https",
  },
});

assert.equal(resolvePublicAppUrl(internalRequest), "https://app.example.com");
assert.equal(
  publicRedirectUrl("/dashboard", internalRequest).href,
  "https://app.example.com/dashboard",
);

const liveRequest = new Request("https://live.coolify.example/voice/receptionist", {
  headers: {
    host: "live.coolify.example",
    "x-forwarded-proto": "https",
  },
});

assert.equal(resolvePublicAppUrl(liveRequest), "https://live.coolify.example");
assert.equal(
  publicRedirectUrl("/login", liveRequest).href,
  "https://live.coolify.example/login",
);

process.env.NODE_ENV = "development";
const localDevRequest = new Request("http://127.0.0.1:3000/api/auth/dev-bypass?next=%2Fappointments%2Foverview", {
  headers: { host: "127.0.0.1:3000" },
});
assert.equal(
  publicRedirectUrl("/appointments/overview", localDevRequest).href,
  "http://127.0.0.1:3000/appointments/overview",
);

delete process.env.NEXT_PUBLIC_APP_URL;
assert.equal(resolvePublicAppUrl(internalRequest), "https://app.example.com");
process.env.APP_URL = "https://app.example.com"; // pragma: allowlist secret
assert.equal(resolvePublicAppUrl(), "https://app.example.com");

if (prevAppUrl === undefined) delete process.env.APP_URL;
else process.env.APP_URL = prevAppUrl;
if (prevPublic === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
else process.env.NEXT_PUBLIC_APP_URL = prevPublic;
if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
else process.env.NODE_ENV = prevNodeEnv;

console.log("test-public-app-url: all checks passed");
