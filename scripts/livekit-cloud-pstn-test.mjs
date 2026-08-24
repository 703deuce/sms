#!/usr/bin/env node
/** Cloud path inbound test via Telnyx API to production DID */
const CLOUD_DID = process.env.PHONE_E164 || "+18663464256";
const FROM = process.env.OUTBOUND_TEST_PHONE;

async function telnyx(path, opts = {}) {
  const res = await fetch(`https://api.telnyx.com/v2${path}`, {
    method: opts.method || "GET",
    headers: {
      Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return res.json();
}

async function listCloudRooms() {
  const { RoomServiceClient } = await import("livekit-server-sdk");
  let url = process.env.LIVEKIT_URL || "";
  if (!url.includes("://")) url = `wss://${url}`;
  url = url.replace(/\.sip\.livekit\.cloud/i, ".livekit.cloud");
  const rsc = new RoomServiceClient(url, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
  return rsc.listRooms();
}

async function main() {
  const before = await listCloudRooms();
  const call = await telnyx("/calls", {
    method: "POST",
    body: {
      connection_id: process.env.TELNYX_CONNECTION_ID,
      to: CLOUD_DID,
      from: FROM,
      timeout_secs: 45,
    },
  });
  console.log(JSON.stringify({ step: "cloud_inbound_placed", callControlId: call.data?.call_control_id, to: CLOUD_DID }, null, 2));
  await new Promise((r) => setTimeout(r, 18000));
  const after = await listCloudRooms();
  const newRooms = after.filter((r) => !before.some((b) => b.name === r.name));
  console.log(JSON.stringify({
    step: "cloud_inbound_observation",
    newRooms: newRooms.map((r) => ({ name: r.name, participants: Number(r.numParticipants) })),
    totalRooms: after.length,
  }, null, 2));
  if (call.data?.call_control_id) {
    await telnyx(`/calls/${call.data.call_control_id}/actions/hangup`, { method: "POST", body: {} }).catch(() => {});
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
