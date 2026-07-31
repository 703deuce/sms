import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const survey = await getPrisma().survey.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!survey) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const responses = await getPrisma().surveyResponse.findMany({
      where: { surveyId: id },
      orderBy: { submittedAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ data: { ...survey, responses } });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const row = await getPrisma().survey.updateMany({
      where: { id, workspaceId: auth.workspaceId },
      data: {
        name: body.name as string | undefined,
        description: body.description as string | undefined,
        status: body.status as string | undefined,
        questions: body.questions as object | undefined,
        settings: body.settings as object | undefined,
      },
    });
    return NextResponse.json({ data: { updated: row.count } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
