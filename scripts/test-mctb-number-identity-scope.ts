/**
 * Proves MCTB voice-ingress (per workspace) is separate from global PLATFORM SMS sender.
 *
 * Run:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-number-identity-scope.ts
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { getPrisma } from "@/lib/db";
import { resolveMctbOutboundSmsRoute } from "@/lib/mctb/messaging/outbound-sms-route";
import { resolveCanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";
import { resolveMctbTexmlIngressConfig } from "@/lib/mctb/texml-ingress/config-cache";
import {
  MCTB_TEXML_ROUTING_MODE,
  MCTB_TEXML_ROUTING_OWNER,
} from "@/lib/mctb/texml-ingress/constants";
import { platformMctbSenderSettings } from "@/lib/messaging/compliance/phone-number-class";
import { mergePhoneCapabilitySettings } from "@/lib/numbers/phone-capabilities";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

function collectTsFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (name === "node_modules" || name === ".git") continue;
    const st = statSync(full);
    if (st.isDirectory()) {
      collectTsFiles(full, acc);
    } else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) {
      acc.push(full);
    }
  }
  return acc;
}

/** Files that assign MissedCallTextConfig.phoneNumberId must not import canonical platform sender. */
const INGRESS_ASSIGNMENT_PATH_PREFIXES = [
  "src/lib/mctb/provisioning/",
  "src/lib/mctb/texml-ingress/",
  "src/lib/agents/missed-call-text-back/config.ts",
  "src/lib/agents/missed-call-text-back/phone-switch.ts",
  "src/app/api/mctb/setup/route.ts",
  "src/app/api/mctb/numbers/route.ts",
  "scripts/attach-mctb-number-to-workspace.ts",
  "scripts/provision-ws1-new-571-mctb.ts",
];

function ingressPhoneSettings(label: string): Record<string, unknown> {
  const base = mergePhoneCapabilitySettings(
    {},
    { mctbEnabled: true, voiceEnabled: true, smsEnabled: true },
  );
  return {
    ...base,
    label,
    mctbRole: "customer_mctb",
    mctbSipIngress: true,
    routingOwner: MCTB_TEXML_ROUTING_OWNER,
    telephony: {
      routingMode: MCTB_TEXML_ROUTING_MODE,
      routingOwner: MCTB_TEXML_ROUTING_OWNER,
      state: "active",
    },
  };
}

function staticProvisioningIndependenceCheck(): void {
  const forbidden = /resolveCanonicalMctbPlatformSender|MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID/;
  for (const rel of INGRESS_ASSIGNMENT_PATH_PREFIXES) {
    const full = path.join(REPO_ROOT, rel);
    const sources = statSync(full).isDirectory() ? collectTsFiles(full) : [full];
    for (const file of sources) {
      const text = readFileSync(file, "utf8");
      if (!text.includes("phoneNumberId") && !text.includes("phone_number_id")) continue;
      assert.equal(
        forbidden.test(text),
        false,
        `${path.relative(REPO_ROOT, file)} must not couple ingress assignment to canonical platform sender`,
      );
    }
  }

  const switchScript = readFileSync(
    path.join(REPO_ROOT, "scripts/switch-mctb-platform-sender-to-telnyx.ts"),
    "utf8",
  );
  assert.equal(
    /missedCallTextConfig/.test(switchScript),
    false,
    "switch-mctb-platform-sender-to-telnyx must not write MissedCallTextConfig",
  );
}

async function dbMultiWorkspaceScopeCheck(): Promise<void> {
  const prisma = getPrisma();
  const token = `identity-scope-${Date.now()}`;
  const platformE164 = `+1555900${String(token).slice(-4)}`;
  const ingressAE164 = `+1555901${String(token).slice(-4)}`;
  const ingressBE164 = `+1555902${String(token).slice(-4)}`;

  const ownerWs = await prisma.workspace.create({
    data: { name: "Platform Owner", slug: `plat-owner-${token}`, type: "BUSINESS" },
  });
  const wsA = await prisma.workspace.create({
    data: { name: "Workspace A", slug: `ws-a-${token}`, type: "BUSINESS" },
  });
  const wsB = await prisma.workspace.create({
    data: { name: "Workspace B", slug: `ws-b-${token}`, type: "BUSINESS" },
  });

  const platformPhone = await prisma.phoneNumber.create({
    data: {
      workspaceId: ownerWs.id,
      e164: platformE164,
      type: "Toll-free",
      status: "Active",
      provider: "telnyx",
      providerNumberId: `mock-platform-${token}`,
      settingsJson: platformMctbSenderSettings({
        provider: "telnyx",
        tfvApproved: true,
      }) as object,
      a2pStatus: "APPROVED",
    },
  });

  const ingressA = await prisma.phoneNumber.create({
    data: {
      workspaceId: wsA.id,
      e164: ingressAE164,
      type: "Local",
      status: "Active",
      provider: "telnyx",
      providerNumberId: `mock-ingress-a-${token}`,
      settingsJson: ingressPhoneSettings("A_INGRESS") as object,
    },
  });
  const ingressB = await prisma.phoneNumber.create({
    data: {
      workspaceId: wsB.id,
      e164: ingressBE164,
      type: "Local",
      status: "Active",
      provider: "telnyx",
      providerNumberId: `mock-ingress-b-${token}`,
      settingsJson: ingressPhoneSettings("B_INGRESS") as object,
    },
  });

  await prisma.missedCallTextConfig.create({
    data: {
      workspaceId: wsA.id,
      phoneNumberId: ingressA.id,
      senderMode: "PLATFORM",
      enabled: true,
      messageTemplate: "A opener",
    },
  });
  await prisma.missedCallTextConfig.create({
    data: {
      workspaceId: wsB.id,
      phoneNumberId: ingressB.id,
      senderMode: "PLATFORM",
      enabled: true,
      messageTemplate: "B opener",
    },
  });

  const prevPlatformId = process.env.MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID;
  process.env.MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID = platformPhone.id;

  try {
    const cfgA = await resolveMctbTexmlIngressConfig(ingressAE164);
    const cfgB = await resolveMctbTexmlIngressConfig(ingressBE164);
    assert.ok(cfgA, "ingress A must resolve");
    assert.ok(cfgB, "ingress B must resolve");
    assert.equal(cfgA!.workspaceId, wsA.id, "DID_A → ws_A");
    assert.equal(cfgB!.workspaceId, wsB.id, "DID_B → ws_B");
    assert.equal(cfgA!.phoneNumberId, ingressA.id);
    assert.equal(cfgB!.phoneNumberId, ingressB.id);

    const canonical = await resolveCanonicalMctbPlatformSender();
    assert.ok(canonical);
    assert.equal(canonical!.phoneNumberId, platformPhone.id);
    assert.notEqual(canonical!.phoneNumberId, ingressA.id);
    assert.notEqual(canonical!.phoneNumberId, ingressB.id);

    const routeA = await resolveMctbOutboundSmsRoute({
      workspaceId: wsA.id,
      config: {
        phoneNumberId: ingressA.id,
        smsPhoneNumberId: null,
        senderMode: "PLATFORM",
      },
    });
    const routeB = await resolveMctbOutboundSmsRoute({
      workspaceId: wsB.id,
      config: {
        phoneNumberId: ingressB.id,
        smsPhoneNumberId: null,
        senderMode: "PLATFORM",
      },
    });

    assert.ok(routeA, "PLATFORM route A");
    assert.ok(routeB, "PLATFORM route B");
    assert.equal(routeA!.fromE164, platformE164, "ws_A PLATFORM From = global sender");
    assert.equal(routeB!.fromE164, platformE164, "ws_B PLATFORM From = global sender");
    assert.notEqual(routeA!.fromE164, ingressAE164);
    assert.notEqual(routeB!.fromE164, ingressBE164);

    const routeWorkB = await resolveMctbOutboundSmsRoute({
      workspaceId: wsB.id,
      config: {
        phoneNumberId: ingressB.id,
        smsPhoneNumberId: null,
        senderMode: "WORKSPACE",
      },
    });
    if (routeWorkB) {
      assert.equal(routeWorkB.phoneNumberId, ingressB.id, "WORKSPACE mode uses ingress DID");
      assert.equal(routeWorkB.senderMode, "WORKSPACE");
    }
  } finally {
    if (prevPlatformId === undefined) {
      delete process.env.MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID;
    } else {
      process.env.MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID = prevPlatformId;
    }
    await prisma.missedCallTextConfig.deleteMany({
      where: { workspaceId: { in: [wsA.id, wsB.id] } },
    });
    await prisma.phoneNumber.deleteMany({
      where: { id: { in: [platformPhone.id, ingressA.id, ingressB.id] } },
    });
    await prisma.workspace.deleteMany({
      where: { id: { in: [ownerWs.id, wsA.id, wsB.id] } },
    });
  }
}

async function main() {
  staticProvisioningIndependenceCheck();
  console.log("static: ingress assignment independent of MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID — ok");

  if (!process.env.DATABASE_URL?.trim()) {
    console.log("db: skipped (no DATABASE_URL); static checks passed");
    return;
  }

  await dbMultiWorkspaceScopeCheck();
  console.log("db: multi-workspace ingress + PLATFORM outbound scope — ok");
  console.log("test:mctb-number-identity-scope ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
