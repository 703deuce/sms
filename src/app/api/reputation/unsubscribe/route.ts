import { NextResponse } from "next/server";
import {
  applyEmailUnsubscribe,
  verifyUnsubscribeToken,
} from "@/lib/reputation/unsubscribe";

function invalidTokenHtml(): NextResponse {
  return new NextResponse("Invalid or expired unsubscribe link.", { status: 400 });
}

function confirmFormHtml(token: string): string {
  const escaped = token.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Unsubscribe</title></head>
<body style="font-family:system-ui;padding:2rem;max-width:32rem">
  <h1>Unsubscribe from review requests?</h1>
  <p>Confirm below to stop review request emails from this business.</p>
  <form method="post" action="/api/reputation/unsubscribe">
    <input type="hidden" name="token" value="${escaped}" />
    <button type="submit" style="margin-top:1rem;padding:0.5rem 1rem">Confirm unsubscribe</button>
  </form>
</body>
</html>`;
}

function successHtml(): string {
  return `<!doctype html><html><body style="font-family:system-ui;padding:2rem"><h1>Unsubscribed</h1><p>You will no longer receive review request emails from this business.</p></body></html>`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const parsed = verifyUnsubscribeToken(token);
  if (!parsed) {
    return invalidTokenHtml();
  }
  return new NextResponse(confirmFormHtml(token), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/** One-click List-Unsubscribe-Post (RFC 8058) and confirm form POST. */
export async function POST(request: Request) {
  const url = new URL(request.url);
  let token = url.searchParams.get("token") ?? "";
  if (!token) {
    try {
      const form = await request.formData();
      token = String(form.get("token") ?? "");
    } catch {
      /* body optional */
    }
  }
  const parsed = verifyUnsubscribeToken(token);
  if (!parsed) {
    const accept = request.headers.get("accept") ?? "";
    if (accept.includes("text/html")) {
      return invalidTokenHtml();
    }
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }
  const result = await applyEmailUnsubscribe(parsed.messageId);
  if (!result.ok) {
    const accept = request.headers.get("accept") ?? "";
    if (accept.includes("text/html")) {
      return new NextResponse("Unable to unsubscribe this address.", { status: 404 });
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return new NextResponse(successHtml(), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return NextResponse.json({ ok: true });
}
