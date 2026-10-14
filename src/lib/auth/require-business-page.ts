import { redirect } from "next/navigation";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { getAuthContext } from "@/lib/auth/context";
import { getBusiness } from "@/lib/db/queries";

export async function requireBusinessPage(businessId: string): Promise<{
  userId: string;
  organizationId: string;
  email: string | null;
}> {
  const auth = await getAuthContext();
  if (!auth.isAuthenticated) redirect("/login");

  try {
    const access = await requireBusinessAccess(businessId);
    return { ...access, email: auth.email };
  } catch {
    redirect("/dashboard?error=access_denied");
  }
}

export async function requireBusinessPageData(businessId: string): Promise<{
  userId: string;
  organizationId: string;
  email: string | null;
  business: NonNullable<Awaited<ReturnType<typeof getBusiness>>>;
}> {
  const auth = await requireBusinessPage(businessId);
  const business = await getBusiness(businessId, auth.organizationId);
  if (!business) redirect("/dashboard?error=access_denied");
  return { ...auth, business };
}
