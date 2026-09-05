/**
 * Live Telnyx API access smoke (optional — requires TELNYX_API_KEY).
 *
 * Meeting API: POST /v2/meeting_sessions with invalid meeting_url should return
 * 400 invalid_request (proves auth + endpoint access; not beta-gated).
 *
 * Video Rooms: POST /v2/rooms should return 201 (room created then deleted).
 *
 * Run: npx tsx scripts/test-telnyx-meeting-video-api-access.ts
 */
const apiKey = process.env.TELNYX_API_KEY?.trim();
if (!apiKey) {
  console.log("SKIP: TELNYX_API_KEY not set — live Telnyx access checks not run.");
  process.exit(0);
}

const base = process.env.TELNYX_API_BASE_URL?.replace(/\/$/, "") || "https://api.telnyx.com/v2";

async function request(method: string, path: string, body?: unknown) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

async function main() {
  const failures: string[] = [];

  const meeting = await request("POST", "/meeting_sessions", {
    meeting_url: "not-a-real-meeting-url",
    bot_name: "Transovo Access Check",
    summarize_on_end: false,
  });

  if (meeting.status === 400) {
    const msg = JSON.stringify(meeting.json);
    if (msg.includes("meeting_url") || msg.includes("Invalid url")) {
      console.log("OK Meeting API: authenticated; endpoint reachable (400 invalid meeting_url)");
    } else {
      failures.push(`Meeting API unexpected 400 body: ${msg}`);
    }
  } else if (meeting.status === 401) {
    failures.push("Meeting API: 401 — check TELNYX_API_KEY");
  } else if (meeting.status === 403) {
    failures.push(`Meeting API: 403 — ${JSON.stringify(meeting.json)}`);
  } else if (meeting.status >= 200 && meeting.status < 300) {
    console.log("OK Meeting API: session created (unexpected for invalid URL but access confirmed)");
  } else {
    failures.push(`Meeting API: HTTP ${meeting.status} — ${JSON.stringify(meeting.json)}`);
  }

  const uniqueName = `transovo-access-check-${Date.now()}`;
  const room = await request("POST", "/rooms", {
    unique_name: uniqueName,
    max_participants: 2,
    enable_recording: false,
  });

  if (room.status >= 200 && room.status < 300) {
    const roomId = (room.json as { data?: { id?: string } })?.data?.id;
    console.log(`OK Video Rooms: room created (${room.status})`);
    if (roomId) {
      const del = await request("DELETE", `/rooms/${encodeURIComponent(roomId)}`);
      if (del.status === 204 || del.status === 200) {
        console.log("OK Video Rooms: smoke room deleted");
      } else {
        console.warn(`WARN Video Rooms: cleanup delete returned ${del.status}`);
      }
    }
  } else if (room.status === 401) {
    failures.push("Video Rooms: 401 — check TELNYX_API_KEY");
  } else if (room.status === 403) {
    failures.push(`Video Rooms: 403 — ${JSON.stringify(room.json)}`);
  } else {
    failures.push(`Video Rooms: HTTP ${room.status} — ${JSON.stringify(room.json)}`);
  }

  if (failures.length) {
    console.error("FAIL");
    for (const f of failures) console.error(` - ${f}`);
    process.exit(1);
  }

  console.log("\nTelnyx Meeting API + Video Rooms access confirmed for this account.");
  console.log("Remaining live validation: create a real Meeting API session with a supported external URL.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
