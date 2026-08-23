// Extracts the local Supabase anon + service_role JWTs from a Kong declarative
// config (passed on stdin). The Supabase CLI generates deterministic demo keys
// for the default local config, but decoding the JWT `role` claim keeps this
// robust across CLI versions instead of hardcoding token strings.
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  const jwts = new Set(input.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []);
  let anon = "";
  let service = "";
  for (const jwt of jwts) {
    try {
      const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
      if (payload.role === "anon") anon = jwt;
      else if (payload.role === "service_role") service = jwt;
    } catch {
      /* ignore non-JWT matches */
    }
  }
  if (!anon || !service) {
    console.error("Failed to extract anon/service_role keys from Kong config");
    process.exit(1);
  }
  process.stdout.write(`ANON_KEY=${anon}\nSERVICE_ROLE_KEY=${service}\n`);
});
