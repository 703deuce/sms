import { NextResponse } from "next/server";
import {
  createMctbRequestFormSubmission,
  loadMctbRequestFormByToken,
} from "@/lib/mctb/request-form";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }
  const form = await loadMctbRequestFormByToken(token);
  if (!form) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }
  return NextResponse.json({
    data: {
      workspaceName: form.workspaceName,
      fields: form.fields,
    },
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token = String(body.token || "").trim();
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  const payload =
    body.payload && typeof body.payload === "object"
      ? (body.payload as Record<string, string>)
      : (body as Record<string, string>);

  const result = await createMctbRequestFormSubmission({
    token,
    payload,
    missedCallEventId: body.missedCallEventId || null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    submissionId: result.submission.id,
  });
}
