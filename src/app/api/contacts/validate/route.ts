import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  validateWorkspaceContacts,
  markInvalidContacts,
} from "@/lib/contacts/validate-list";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      action?: string;
      phones?: string[];
      markInvalid?: boolean;
    };

    if (body.action === "mark_invalid" && body.phones?.length) {
      const result = await markInvalidContacts(auth.workspaceId, body.phones);
      return NextResponse.json({ data: result });
    }

    const data = await validateWorkspaceContacts(auth.workspaceId, body.phones);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
