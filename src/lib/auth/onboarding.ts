import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "workspace"
  );
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let i = 0;
  while (true) {
    const { data } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return slug;
    i += 1;
    slug = `${base}-${i}`;
  }
}

async function findMembershipOrgId(userId: string): Promise<string | null> {
  const { data: membership } = await supabaseAdmin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return membership?.organization_id ?? null;
}

export async function ensureUserOrganization(user: User): Promise<string> {
  const existing = await findMembershipOrgId(user.id);
  if (existing) {
    await upsertProfile(user);
    return existing;
  }

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "My Workspace";

  // Retry once on race: concurrent signup can create the first membership between
  // the check above and this insert.
  for (let attempt = 0; attempt < 2; attempt++) {
    const raced = await findMembershipOrgId(user.id);
    if (raced) {
      await upsertProfile(user);
      return raced;
    }

    const slug = await uniqueSlug(slugify(displayName));
    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .insert({
        name: displayName,
        slug,
        plan: "starter",
        created_by: user.id,
        status: "active",
        billing_status: "manual",
      })
      .select("id")
      .single();

    if (orgError || !org) {
      // Unique slug collision or concurrent create — retry lookup.
      if (attempt === 0) continue;
      throw new Error(`Failed to create organization: ${orgError?.message}`);
    }

    const { error: memberError } = await supabaseAdmin.from("organization_members").insert({
      organization_id: org.id,
      user_id: user.id,
      role: "owner",
    });

    if (memberError) {
      const afterRace = await findMembershipOrgId(user.id);
      if (afterRace) {
        await upsertProfile(user);
        return afterRace;
      }
      if (attempt === 0) continue;
      throw new Error(`Failed to create organization membership: ${memberError.message}`);
    }

    await upsertProfile(user);
    return org.id;
  }

  throw new Error("Failed to create organization after retry");
}

async function upsertProfile(user: User): Promise<void> {
  await supabaseAdmin.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? null,
      full_name:
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        null,
      avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
}

export async function getOrganizationIdForUser(userId: string): Promise<string | null> {
  return findMembershipOrgId(userId);
}
