import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { resolveWorkspaceBySlug } from "@/lib/appointments";
import { listRoutingForms, recordRoutingAnalytics, resolveRoutingFormDestination } from "@/lib/appointments/routing-forms";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const workspace = await resolveWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const forms = await listRoutingForms(workspace.id);
    const publicForms = forms.filter((f) => f.active !== false).map((f) => ({
      id: f.id,
      name: f.name,
      slug: f.slug,
      headline: f.headline,
      fields: f.fields,
    }));
    return NextResponse.json({ data: publicForms });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const workspace = await resolveWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = (await request.json()) as { formId?: string; answers?: Record<string, string> };
    const forms = await listRoutingForms(workspace.id);
    const form = forms.find((f) => f.id === body.formId);
    if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });
    const destination = resolveRoutingFormDestination(form, body.answers || {});
    await recordRoutingAnalytics(workspace.id, form.id, destination || {});
    return NextResponse.json({ data: { destination } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
