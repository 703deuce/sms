/**
 * Seed demo workspace into Supabase.
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 *
 * Login: alex@harborhome.co / demo1234
 */
import { hash } from "bcryptjs";
import { getSupabaseAdmin } from "../src/lib/supabase/admin";
import { createId } from "../src/lib/supabase/id";

async function main() {
  const sb = getSupabaseAdmin();

  const userId = createId();
  const workspaceId = "ws_1";
  const passwordHash = await hash("demo1234", 10);

  const { error: userErr } = await sb.from("User").upsert({
    id: userId,
    email: "alex@harborhome.co",
    name: "Alex Rivera",
    passwordHash,
    isPlatformAdmin: true,
  });
  if (userErr) throw userErr;

  const { error: wsErr } = await sb.from("Workspace").upsert({
    id: workspaceId,
    name: "Harbor Home Services",
    slug: "harbor-home",
    billingPlan: "growth",
    creditBalanceCents: 2500,
  });
  if (wsErr) throw wsErr;

  const { error: memErr } = await sb.from("Membership").upsert({
    id: createId(),
    userId,
    workspaceId,
    role: "OWNER",
  });
  if (memErr) throw memErr;

  console.log("Seeded workspace", workspaceId);
  console.log("Login: alex@harborhome.co / demo1234");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
