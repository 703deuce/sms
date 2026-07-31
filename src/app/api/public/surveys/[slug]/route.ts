import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

type SurveySettings = { slug?: string };

async function findActiveSurvey(slug: string) {
  const prisma = getPrisma();
  const byId = await prisma.survey.findFirst({
    where: { id: slug, status: "active" },
  });
  if (byId) return byId;

  const active = await prisma.survey.findMany({
    where: { status: "active" },
    take: 500,
  });
  return active.find((s: { settings: unknown; id: string }) => {
    const settings = s.settings as SurveySettings;
    return settings?.slug === slug;
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const survey = await findActiveSurvey(slug);
    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    const settings = survey.settings as SurveySettings;
    return NextResponse.json({
      data: {
        id: survey.id,
        name: survey.name,
        description: survey.description,
        surveyType: survey.surveyType,
        questions: survey.questions,
        settings: survey.settings,
        slug: settings?.slug || survey.id,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const survey = await findActiveSurvey(slug);
    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    const body = (await request.json()) as {
      answers?: Record<string, unknown>;
      phone?: string;
      contactId?: string;
    };

    if (!body.answers || typeof body.answers !== "object") {
      return NextResponse.json({ error: "answers required" }, { status: 400 });
    }

    const row = await getPrisma().surveyResponse.create({
      data: {
        workspaceId: survey.workspaceId,
        surveyId: survey.id,
        contactId: body.contactId || null,
        phone: body.phone?.trim() || null,
        answers: body.answers,
      },
    });

    const settings = survey.settings as { thankYouMessage?: string };
    return NextResponse.json({
      ok: true,
      id: row.id,
      thankYouMessage: settings?.thankYouMessage || "Thank you for your response!",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Submission failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
