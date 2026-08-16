import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  revealPersonalPortOutCredentials,
  setPersonalPortOutPin,
  syncPersonalPortOutFromTelnyx,
} from "@/lib/numbers/personal-port-out-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ numberId: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { numberId } = await params;
    const creds = await revealPersonalPortOutCredentials(auth.workspaceId, numberId);
    return NextResponse.json({ data: creds });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ numberId: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { numberId } = await params;
    const body = (await request.json()) as {
      action?: "sync" | "unlock" | "lock" | "set_pin";
      pin?: string;
    };

    if (body.action === "sync") {
      const data = await syncPersonalPortOutFromTelnyx(auth.workspaceId, numberId);
      return NextResponse.json({ data });
    }

    if (body.action === "unlock") {
      const data = await setPersonalPortOutPin(auth.workspaceId, numberId, body.pin || "", false);
      return NextResponse.json({ data });
    }

    if (body.action === "lock") {
      const data = await setPersonalPortOutPin(
        auth.workspaceId,
        numberId,
        body.pin || "",
        true,
      );
      return NextResponse.json({ data, locked: true });
    }

    if (body.action === "set_pin" && body.pin?.trim()) {
      const data = await setPersonalPortOutPin(
        auth.workspaceId,
        numberId,
        body.pin.trim(),
        false,
      );
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
