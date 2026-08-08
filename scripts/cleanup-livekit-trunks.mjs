#!/usr/bin/env node
/**
 * List and optionally delete conflicting LiveKit SIP trunks
 * Usage: LIVEKIT_URL=... LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=... node scripts/cleanup-livekit-trunks.mjs [--delete]
 */

import { SipClient } from "livekit-server-sdk";

const DELETE = process.argv.includes("--delete");
const PHONE_NUMBER = "+18663464256";

async function main() {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!url || !apiKey || !apiSecret) {
    console.error("Missing LIVEKIT_URL, LIVEKIT_API_KEY, or LIVEKIT_API_SECRET");
    process.exit(1);
  }

  const client = new SipClient(url, apiKey, apiSecret);
  
  console.log("Listing all SIP inbound trunks...");
  const trunks = await client.listSipInboundTrunk();
  
  console.log(`\nFound ${trunks.length} trunk(s):\n`);
  
  const conflicting = [];
  for (const trunk of trunks) {
    const hasNumber = (trunk.numbers || []).includes(PHONE_NUMBER);
    console.log(`- ${trunk.name || trunk.sipTrunkId}`);
    console.log(`  ID: ${trunk.sipTrunkId}`);
    console.log(`  Numbers: ${(trunk.numbers || []).join(", ") || "none"}`);
    console.log(`  Has ${PHONE_NUMBER}: ${hasNumber ? "YES" : "no"}`);
    console.log(`  Metadata: ${trunk.metadata || "none"}`);
    console.log();
    
    if (hasNumber) {
      conflicting.push(trunk);
    }
  }

  console.log(`\nTrunks with ${PHONE_NUMBER}: ${conflicting.length}`);
  
  if (conflicting.length > 1) {
    console.log("\n⚠️  CONFLICT DETECTED: Multiple trunks have the same number!");
    console.log("Conflicting trunks:");
    for (const trunk of conflicting) {
      console.log(`  - ${trunk.name || trunk.sipTrunkId} (${trunk.sipTrunkId})`);
    }
    
    if (DELETE) {
      console.log("\n🗑️  Deleting non-Transovo trunks...");
      for (const trunk of conflicting) {
        const meta = trunk.metadata ? JSON.parse(trunk.metadata) : {};
        const isTransovo = meta.owner === "transovo" || (trunk.name || "").includes("transovo");
        
        if (!isTransovo) {
          console.log(`  Deleting: ${trunk.name || trunk.sipTrunkId}`);
          await client.deleteSipTrunk(trunk.sipTrunkId);
          console.log(`  ✅ Deleted`);
        } else {
          console.log(`  Keeping Transovo trunk: ${trunk.name}`);
        }
      }
    } else {
      console.log("\nTo delete conflicting trunks, run with --delete flag");
    }
  } else if (conflicting.length === 1) {
    console.log(`\n✅ OK: Only one trunk has ${PHONE_NUMBER}`);
  } else {
    console.log(`\n⚠️  No trunk has ${PHONE_NUMBER}`);
  }
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});
