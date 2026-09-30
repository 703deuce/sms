import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  loadMctbOwnSenderA2pIntake,
  saveMctbOwnSenderA2pIntake,
  type SaveMctbOwnSenderA2pIntakeInput,
} from "@/lib/mctb/own-sender-a2p-intake";
import { resolveMctbCapabilities } from "@/lib/mctb/capabilities";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const capabilities = await resolveMctbCapabilities(auth.workspaceId);
    const entitled =
      capabilities.ownSenderAddOnEntitled || capabilities.customerOwnedSender;
    const intake = entitled
      ? await loadMctbOwnSenderA2pIntake(auth.workspaceId)
      : null;

    return NextResponse.json({
      data: {
        intake,
        entitled,
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const capabilities = await resolveMctbCapabilities(auth.workspaceId);
    if (!capabilities.ownSenderAddOnEntitled && !capabilities.customerOwnedSender) {
      return NextResponse.json(
        {
          error:
            "Own Local Number add-on is required before saving A2P registration details.",
        },
        { status: 403 },
      );
    }

    const body = (await req.json()) as SaveMctbOwnSenderA2pIntakeInput & { submit?: boolean };
    const intake = await saveMctbOwnSenderA2pIntake(
      auth.workspaceId,
      {
        status: body.status === "submitted" ? "submitted" : "draft",
        legalBusinessName: String(body.legalBusinessName || ""),
        einOrTaxId: String(body.einOrTaxId || ""),
        businessWebsite: String(body.businessWebsite || ""),
        businessAddressLine1: String(body.businessAddressLine1 || ""),
        businessCity: String(body.businessCity || ""),
        businessState: String(body.businessState || ""),
        businessPostalCode: String(body.businessPostalCode || ""),
        contactEmail: String(body.contactEmail || ""),
        contactPhone: String(body.contactPhone || ""),
        desiredAreaCode: String(body.desiredAreaCode || ""),
        useCaseDescription: String(body.useCaseDescription || ""),
        submit: body.submit === true,
      },
      auth.userId,
    );

    return NextResponse.json({ data: { intake } });
  } catch (err) {
    if (err instanceof Error && err.message === "validation_failed") {
      const fieldErrors = (err as Error & { fieldErrors?: Record<string, string> }).fieldErrors;
      return NextResponse.json({ error: "Validation failed", fieldErrors }, { status: 400 });
    }
    return jsonError(err, 400);
  }
}
