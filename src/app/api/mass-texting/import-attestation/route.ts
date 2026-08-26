import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import {
  MASS_TEXT_LIST_ATTESTATION_TEXT,
  MASS_TEXT_LIST_ATTESTATION_VERSION,
} from "@/lib/mass-texting/constants";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      listId?: string;
      listName?: string;
      contactCount?: number;
      source?: string;
      attestationAccepted?: boolean;
    };

    if (!body.attestationAccepted) {
      return NextResponse.json(
        { error: "You must confirm list consent attestation before import." },
        { status: 400 },
      );
    }

    const row = await getPrisma().listImportAttestation.create({
      data: {
        workspaceId: auth.workspaceId,
        userId: auth.session.userId,
        listId: body.listId || null,
        listName: body.listName || null,
        contactCount: body.contactCount ?? 0,
        attestationVersion: MASS_TEXT_LIST_ATTESTATION_VERSION,
        attestationText: MASS_TEXT_LIST_ATTESTATION_TEXT,
        source: body.source || "csv_import",
      },
    });

    return NextResponse.json({ data: { id: row.id } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
