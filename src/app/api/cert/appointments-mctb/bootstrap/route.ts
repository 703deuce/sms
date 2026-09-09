import { NextResponse } from "next/server";
import { jsonError, requireSession } from "@/lib/api-auth";
import { CERT_BROWSER_EMAIL } from "@/lib/cert/appointments-mctb-browser-cert-constants";
import {
  bootstrapAppointmentsMctbBrowserCertWorkspace,
} from "@/lib/cert/appointments-mctb-browser-bootstrap";

/**
 * Idempotent bootstrap for the Appointments + MCTB browser cert workspace on preview.
 * Restricted to the dedicated cert account (or platform admin).
 */
export async function POST() {
  try {
    const auth = await requireSession();
    if (!auth.session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!auth.workspaceId) {
      return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
    }
    const email = auth.session.email?.toLowerCase() || "";
    const allowed =
      email === CERT_BROWSER_EMAIL.toLowerCase() || Boolean(auth.session.isAdmin);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await bootstrapAppointmentsMctbBrowserCertWorkspace(auth.workspaceId);
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return jsonError(err, 500);
  }
}
