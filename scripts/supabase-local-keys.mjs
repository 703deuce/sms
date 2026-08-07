// Prints the local Supabase anon + service_role API keys.
//
// The Supabase CLI local stack validates API keys as HS256 JWTs signed with a
// fixed, well-known local JWT secret. We mint the tokens deterministically here
// so the app's .env matches the local stack without needing to scrape them from
// `supabase status` (which does not print them when auth is disabled).
//
// Output:
//   ANON=<jwt>
//   SERVICE=<jwt>
import crypto from "node:crypto";

const SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

function mint(role) {
  const header = { alg: "HS256", typ: "JWT" };
  // Fixed iat/exp reproduce the canonical long-lived local demo tokens.
  const payload = { role, iss: "supabase-demo", iat: 1641769200, exp: 1799535600 };
  const data = `${b64url(header)}.${b64url(payload)}`;
  const sig = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

console.log(`ANON=${mint("anon")}`);
console.log(`SERVICE=${mint("service_role")}`);
