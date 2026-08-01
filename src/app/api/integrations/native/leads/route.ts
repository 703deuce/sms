import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const rows = await getPrisma().formSubmission.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { form: true },
    });

    const submissions = (
      rows as Array<{
        id: string;
        phone: string;
        contactId: string | null;
        createdAt: Date;
        payload: unknown;
        form: { name: string; slug: string | null; config: unknown };
      }>
    )
      .filter((r) => {
        const cfg = (r.form.config || {}) as Record<string, unknown>;
        return cfg.source === "native_integration" || Boolean(cfg.provider);
      })
      .map((r) => {
        const payload = (r.payload || {}) as Record<string, unknown>;
        const cfg = (r.form.config || {}) as Record<string, unknown>;
        return {
          id: r.id,
          phone: r.phone,
          contactId: r.contactId,
          createdAt: r.createdAt.toISOString(),
          formName: r.form.name,
          formSlug: r.form.slug,
          provider: (payload.provider as string) || (cfg.provider as string) || null,
          email: (payload.email as string) || null,
          answers: (payload.answers as Record<string, unknown>) || {},
        };
      });

    return NextResponse.json({ data: { submissions } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
