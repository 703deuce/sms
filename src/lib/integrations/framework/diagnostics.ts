import { getPrisma } from "@/lib/db";
import { getConnection } from "@/lib/integrations/connections";
import { writeIntegrationAudit } from "./audit";
import { buildAdapterContext } from "./context";
import { oauthEnvReady } from "./oauth";
import { getAdapter } from "./registry";
import { getIntegrationPreferences } from "./settings";
import type { ExternalProviderId } from "./types";

export async function getIntegrationDiagnosticsSnapshot(
  workspaceId: string,
  provider: ExternalProviderId,
) {
  const adapter = getAdapter(provider);
  const conn = await getConnection(workspaceId, provider);
  const prefs = await getIntegrationPreferences(workspaceId, provider);
  const prisma = getPrisma();

  const [mappingCount, pendingJobs, failedJobs, deadLetters, recentWebhooks, recentSyncs] =
    await Promise.all([
      prisma.crmObjectMapping.count({ where: { workspaceId, provider } }),
      prisma.jobQueue.count({
        where: {
          workspaceId,
          status: { in: ["pending", "processing", "deferred"] },
          jobType: { startsWith: "integration_" },
        },
      }),
      prisma.jobQueue.count({
        where: {
          workspaceId,
          status: "failed",
          jobType: { startsWith: "integration_" },
        },
      }),
      prisma.crmDeadLetter.count({ where: { workspaceId, provider } }),
      prisma.crmWebhookEvent.count({ where: { workspaceId, provider } }),
      prisma.crmSyncRun.findMany({
        where: { workspaceId, provider },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

  const cfg = (conn?.configJson || {}) as Record<string, unknown>;
  const env =
    adapter.authKind === "oauth"
      ? oauthEnvReady(provider)
      : { ready: true, missing: [] as string[], callbackUrl: null };

  let calendly: Record<string, unknown> | undefined;
  if (provider === "calendly") {
    const {
      resolveCalendlyWebhookSigningKey,
      calendlyWebhookSigningKeyEnvPresence,
      calendlyWebhookSigningKeyFingerprint,
      CALENDLY_WEBHOOK_SIGNING_KEY_ENVS,
      listCalendlyEnvNamesPresent,
    } = await import("../adapters/calendly");
    const { externalWebhookUrl } = await import("./app-url");
    const token = typeof cfg.webhookToken === "string" ? cfg.webhookToken : null;
    const setupError = typeof cfg.webhookSetupError === "string" ? cfg.webhookSetupError : null;
    const subscriptionIds = Array.isArray(cfg.webhookSubscriptionIds)
      ? (cfg.webhookSubscriptionIds as string[])
      : [];
    const signingFromConfig = Boolean(
      typeof cfg.signingKey === "string" && cfg.signingKey.trim(),
    );
    const signingEnv = calendlyWebhookSigningKeyEnvPresence();
    const calendlyEnvNamesPresent = listCalendlyEnvNamesPresent();
    const signingKeySource =
      typeof cfg.signingKeySource === "string" ? cfg.signingKeySource : null;
    const subscriptionSigningKeyCaptured =
      signingFromConfig && signingKeySource === "calendly_subscription_create";
    const envSigningPresent = Object.values(signingEnv).some(Boolean);
    calendly = {
      callbackUrl: typeof env === "object" && env && "callbackUrl" in env ? env.callbackUrl : null,
      webhookUrl: externalWebhookUrl("calendly", token),
      webhookSigningKeyPresent: Boolean(resolveCalendlyWebhookSigningKey(cfg)),
      webhookSigningKeyFromConfig: signingFromConfig,
      /** True only when signing key was captured from Calendly's create response (PAT). */
      webhookSubscriptionSigningKeyCaptured: subscriptionSigningKeyCaptured,
      webhookSigningKeySource: signingKeySource,
      webhookSigningKeyCapturedAt:
        typeof cfg.signingKeyCapturedAt === "string" ? cfg.signingKeyCapturedAt : null,
      /** sha256 hex prefix of the active key — compare across Coolify/portal without leaking. */
      webhookSigningKeyFingerprint: calendlyWebhookSigningKeyFingerprint(cfg),
      webhookSigningKeyEnv: signingEnv,
      webhookSigningKeyEnvNames: [...CALENDLY_WEBHOOK_SIGNING_KEY_ENVS],
      /**
       * OAuth apps sign with the developer-portal webhook key (Coolify env).
       * Risk = subscription exists but we have neither env key nor a captured create key.
       */
      webhookSigningKeyMismatchRisk:
        subscriptionIds.length > 0 && !subscriptionSigningKeyCaptured && !envSigningPresent,
      /** Names only — proves which Calendly vars Coolify actually injected into this container. */
      calendlyEnvNamesPresent,
      clientIdPresent: calendlyEnvNamesPresent.some((n) => n === "CALENDLY_CLIENT_ID"),
      clientSecretPresent: calendlyEnvNamesPresent.some((n) => n === "CALENDLY_CLIENT_SECRET"),
      userUri: cfg.userUri || conn?.externalId || null,
      organizationUri: cfg.organizationUri || null,
      timezone: cfg.timezone || null,
      schedulingUrl: cfg.schedulingUrl || null,
      webhookSubscriptionIds: subscriptionIds,
      webhookSubscriptionScope:
        typeof cfg.webhookSubscriptionScope === "string"
          ? cfg.webhookSubscriptionScope
          : null,
      webhookSetupError: setupError,
      /** Any HTTP hit to our webhook URL (including 401) — proves Calendly/edge reached us. */
      lastWebhookHitAt:
        typeof cfg.lastWebhookHitAt === "string" ? cfg.lastWebhookHitAt : null,
      lastWebhookHitStatus:
        typeof cfg.lastWebhookHitStatus === "number" ? cfg.lastWebhookHitStatus : null,
      lastWebhookHitReason:
        typeof cfg.lastWebhookHitReason === "string" ? cfg.lastWebhookHitReason : null,
      webhookHitCount: Number(cfg.webhookHitCount || 0) || 0,
      webhooksPlanBlocked: Boolean(
        setupError &&
          /Blocked by Calendly plan|Standard, Teams, or Enterprise/i.test(setupError),
      ),
      scopesRequested: adapter.oauth?.scopes || [],
    };

    // Live subscription status from Calendly (retry_started_at = delivery failing).
    try {
      const { listWebhookSubscriptions } = await import("../adapters/calendly-actions");
      const ctx = await buildAdapterContext(workspaceId, provider);
      const listed = await listWebhookSubscriptions(ctx);
      const live = listed.subscriptions || [];
      calendly.webhookSubscriptionsLive = live.map((s) => ({
        uri: s.uri,
        callbackUrl: s.callbackUrl,
        state: s.state,
        scope: s.scope,
        events: s.events,
        retryStartedAt: s.retryStartedAt,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }));
      calendly.webhookDeliveryFailing = live.some((s) => Boolean(s.retryStartedAt));
      calendly.webhookActiveCount = live.filter((s) => /active/i.test(s.state || "")).length;
      // Active sub + no inbound hits after events usually means Calendly never POSTed.
      calendly.webhookSilentDeliveryRisk =
        live.some((s) => /active/i.test(s.state || "")) &&
        !cfg.lastWebhookHitAt &&
        !cfg.lastWebhookAt;
    } catch (err) {
      calendly.webhookSubscriptionsLiveError =
        err instanceof Error ? err.message : String(err);
    }
  }

  return {
    provider,
    displayName: adapter.displayName,
    authKind: adapter.authKind,
    status: conn?.status || "disconnected",
    syncStatus: conn?.syncStatus || "idle",
    accountId: conn?.externalId || null,
    accountName: conn?.connectedAccountName || null,
    lastSyncAt: conn?.lastSyncAt?.toISOString() || null,
    lastFailedSyncAt: conn?.lastFailedSyncAt?.toISOString() || null,
    lastError: conn?.lastError || null,
    lastWebhookAt: (cfg.lastWebhookAt as string) || null,
    lastValidatedAt: (cfg.lastValidatedAt as string) || null,
    capabilities: cfg.capabilities || adapter.capabilities,
    scopes: cfg.scopesGranted || adapter.oauth?.scopes || [],
    paused: prefs.paused,
    preferences: {
      enableReads: prefs.enableReads,
      enableWrites: prefs.enableWrites,
      webhooks: prefs.webhooks,
      autoCreateContacts: prefs.autoCreateContacts,
    },
    counts: {
      mappings: mappingCount,
      pendingJobs,
      failedJobs,
      deadLetters,
      webhooks: recentWebhooks,
    },
    recentSyncs: recentSyncs.map(
      (s: {
        id: string;
        kind: string;
        status: string;
        startedAt: Date | null;
        finishedAt: Date | null;
        lastError: string | null;
      }) => ({
        id: s.id,
        kind: s.kind,
        status: s.status,
        startedAt: s.startedAt,
        finishedAt: s.finishedAt,
        lastError: s.lastError,
      }),
    ),
    env,
    secretsPresent: {
      accessToken: Boolean(conn?.accessToken),
      refreshToken: Boolean(conn?.refreshToken),
    },
    ...(calendly ? { calendly } : {}),
  };
}

export async function runIntegrationProbe(
  workspaceId: string,
  provider: ExternalProviderId,
  probe:
    | "validate"
    | "identify"
    | "read"
    | "write"
    | "force_sync"
    | "register_webhooks"
    | "book_invitee"
    | "cancel_event"
    | "webhook_self_test",
  actorUserId?: string | null,
  params?: Record<string, unknown>,
) {
  const adapter = getAdapter(provider);
  const started = Date.now();
  try {
    if (probe === "force_sync") {
      const { enqueueIntegrationSync } = await import("./sync");
      const run = await enqueueIntegrationSync({
        workspaceId,
        provider,
        kind: "manual",
        triggeredBy: actorUserId,
      });
      return { ok: true, probe, durationMs: Date.now() - started, data: { syncRunId: run.id } };
    }

    const ctx = await buildAdapterContext(workspaceId, provider);

    if (probe === "validate") {
      const health = await adapter.validateConnection(ctx);
      await writeIntegrationAudit({
        workspaceId,
        provider,
        category: "diagnostics",
        action: "probe_validate",
        message: health.ok ? "Validate OK" : health.message || "Validate failed",
        actorUserId,
      });
      return { ok: health.ok, probe, durationMs: Date.now() - started, data: health };
    }

    if (probe === "identify") {
      const id = await adapter.identifyAccount(ctx);
      return { ok: true, probe, durationMs: Date.now() - started, data: id };
    }

    if (probe === "read") {
      const sample: Record<string, unknown> = {};
      if (adapter.listContacts) {
        sample.contacts = (await adapter.listContacts(ctx, null)).items.slice(0, 3);
      } else if (adapter.listForms) {
        sample.forms = (await adapter.listForms(ctx)).items.slice(0, 3);
      } else if (adapter.listAppointments) {
        sample.appointments = (await adapter.listAppointments(ctx)).items.slice(0, 3);
      } else if (adapter.listOrders) {
        sample.orders = (await adapter.listOrders(ctx)).items.slice(0, 3);
      } else if (adapter.listTickets) {
        sample.tickets = (await adapter.listTickets(ctx)).items.slice(0, 3);
      }
      return { ok: true, probe, durationMs: Date.now() - started, data: sample };
    }

    if (probe === "write") {
      if (!adapter.createTestRecord) {
        return {
          ok: false,
          probe,
          durationMs: Date.now() - started,
          error: "Write probe not supported",
        };
      }
      const created = await adapter.createTestRecord(ctx);
      const readBack = adapter.readTestRecord
        ? await adapter.readTestRecord(ctx, created.objectType, created.externalId)
        : null;
      if (adapter.updateTestRecord) {
        await adapter.updateTestRecord(ctx, created.objectType, created.externalId);
      }
      if (adapter.cleanupTestRecord) {
        await adapter.cleanupTestRecord(ctx, created.objectType, created.externalId);
      }
      return {
        ok: true,
        probe,
        durationMs: Date.now() - started,
        data: { created, readBack: Boolean(readBack) },
      };
    }

    if (probe === "cancel_event") {
      if (provider !== "calendly") {
        return {
          ok: false,
          probe,
          durationMs: Date.now() - started,
          error: "cancel_event is Calendly-only",
        };
      }
      const { cancelAppointment } = await import("../adapters/calendly-actions");
      const eventUri = String(params?.eventUri || "").trim();
      const eventUuid = String(params?.eventUuid || "").trim();
      if (!eventUri && !eventUuid) {
        return {
          ok: false,
          probe,
          durationMs: Date.now() - started,
          error: "params.eventUri or params.eventUuid required",
        };
      }
      const canceled = await cancelAppointment(ctx, {
        eventUri: eventUri || undefined,
        eventUuid: eventUuid || undefined,
        reason: String(params?.reason || "Diagnostics cancel — webhook delivery test"),
      });
      await writeIntegrationAudit({
        workspaceId,
        provider,
        category: "diagnostics",
        action: "probe_cancel_event",
        message: `Canceled ${canceled.eventUuid}`,
        actorUserId,
      });
      return { ok: true, probe, durationMs: Date.now() - started, data: canceled };
    }

    if (probe === "book_invitee") {
      if (provider !== "calendly") {
        return {
          ok: false,
          probe,
          durationMs: Date.now() - started,
          error: "book_invitee is Calendly-only (Scheduling API POST /invitees)",
        };
      }
      const { bookNextAvailableSlot, bookEventInvitee } = await import(
        "../adapters/calendly-actions"
      );
      const name = String(params?.name || "Transovo Voice Booking").trim();
      const email = String(params?.email || "").trim();
      if (!email) {
        return {
          ok: false,
          probe,
          durationMs: Date.now() - started,
          error: "params.email required",
        };
      }
      const booked = params?.startTime
        ? await bookEventInvitee(ctx, {
            eventTypeUri: (params.eventTypeUri as string) || undefined,
            startTime: String(params.startTime),
            name,
            email,
            timezone: (params.timezone as string) || "America/New_York",
            phone: (params.phone as string) || null,
          })
        : await bookNextAvailableSlot(ctx, {
            eventTypeUri: (params?.eventTypeUri as string) || undefined,
            name,
            email,
            timezone: (params?.timezone as string) || "America/New_York",
            phone: (params?.phone as string) || null,
          });

      // Immediate product write-through (same as appointment.book action).
      try {
        const { persistAppointmentFromIntegration } = await import("./product-persist");
        const { getAppointment } = await import("../adapters/calendly-actions");
        const details = await getAppointment(ctx, { eventUri: booked.eventUri });
        await persistAppointmentFromIntegration({
          workspaceId,
          provider: "calendly",
          contactId: null,
          appointment: {
            id: booked.eventUri,
            title: "Calendly booking",
            startAt: details.startsAt || booked.startTime,
            endAt: details.endsAt,
            status: details.status || booked.status || "confirmed",
            inviteeEmail: email,
            inviteeName: name,
            cancelUrl: booked.cancelUrl,
            rescheduleUrl: booked.rescheduleUrl,
            eventTypeId: booked.eventTypeUri,
            metadata: { inviteeUri: booked.inviteeUri, bookedVia: "probe_book_invitee" },
          },
        });
      } catch (persistErr) {
        console.warn(
          "[probe book_invitee] product persist skipped",
          persistErr instanceof Error ? persistErr.message : persistErr,
        );
      }

      await writeIntegrationAudit({
        workspaceId,
        provider,
        category: "diagnostics",
        action: "probe_book_invitee",
        message: `Booked ${booked.eventUri} for ${email}`,
        actorUserId,
      });
      return { ok: true, probe, durationMs: Date.now() - started, data: booked };
    }

    if (probe === "register_webhooks") {
      if (!adapter.registerWebhooks) {
        return {
          ok: false,
          probe,
          durationMs: Date.now() - started,
          error: "Webhook registration unsupported",
        };
      }
      const { externalWebhookUrl } = await import("./app-url");
      const { getConnection, upsertConnection } = await import(
        "@/lib/integrations/connections"
      );
      const conn = await getConnection(workspaceId, provider);
      const cfg = (conn?.configJson || {}) as Record<string, unknown>;
      let token =
        typeof cfg.webhookToken === "string" && cfg.webhookToken.trim()
          ? cfg.webhookToken.trim()
          : "";
      if (!token) {
        const { randomBytes } = await import("crypto");
        token = randomBytes(24).toString("hex");
        await upsertConnection({
          workspaceId,
          provider,
          config: { webhookToken: token },
          mergeConfig: true,
        });
      }
      const overrideUrl =
        typeof params?.callbackUrl === "string" && params.callbackUrl.trim()
          ? params.callbackUrl.trim()
          : "";
      const url = overrideUrl || externalWebhookUrl(provider, token);
      const scopePref =
        params?.scope === "user" || params?.scope === "organization"
          ? (params.scope as "user" | "organization")
          : undefined;
      try {
        // Wipe ALL Transovo Calendly webhook URLs for this user (including orphan
        // smoke-test tokens). Otherwise Calendly fans out to dead endpoints that
        // 401 forever (retry_started_at) while Harbor never sees a clean delivery.
        let cleaned: { deleted: string[]; kept: string[] } | null = null;
        if (provider === "calendly") {
          const { cleanupTransovoWebhookSubscriptions } = await import(
            "../adapters/calendly-actions"
          );
          cleaned = await cleanupTransovoWebhookSubscriptions(ctx, null);
        } else {
          const priorIds = Array.isArray(cfg.webhookSubscriptionIds)
            ? (cfg.webhookSubscriptionIds as string[])
            : [];
          if (adapter.removeWebhooks && priorIds.length) {
            await adapter.removeWebhooks(ctx, priorIds).catch(() => undefined);
          }
        }
        const result = await adapter.registerWebhooks(ctx, url, {
          scope: scopePref,
        });
        const nextConfig: Record<string, unknown> = {
          webhookSubscriptionIds: result.ids,
          webhookCallbackUrl: url,
          webhookSubscriptionScope: result.scope || scopePref || null,
          webhookSetupError: null,
        };
        // Don't persist a temporary external callback as the canonical Harbor URL.
        if (overrideUrl) {
          nextConfig.webhookCallbackUrl = externalWebhookUrl(provider, token);
          nextConfig.webhookDiagnosticCallbackUrl = overrideUrl;
        }
        if (result.signingKey) {
          nextConfig.signingKey = result.signingKey;
          nextConfig.signingKeySource = "calendly_subscription_create";
          nextConfig.signingKeyCapturedAt = new Date().toISOString();
        } else if (provider === "calendly") {
          // OAuth app path: use Coolify developer-portal key; drop stale config
          // signingKey so it cannot override a corrected env value.
          nextConfig.signingKey = null;
          nextConfig.signingKeySource = "oauth_app_env";
          nextConfig.signingKeyCapturedAt = new Date().toISOString();
        }
        await upsertConnection({
          workspaceId,
          provider,
          config: nextConfig,
          mergeConfig: true,
        });
        return {
          ok: true,
          probe,
          durationMs: Date.now() - started,
          data: {
            ids: result.ids,
            url,
            scope: result.scope || scopePref || null,
            signingKeyCaptured: Boolean(result.signingKey),
            signingMode: result.signingKey ? "subscription_create" : "oauth_app_env",
            createResponseKeys: result.createResponseKeys || [],
            cleanedOrphans: cleaned?.deleted || [],
            diagnosticOverride: Boolean(overrideUrl),
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const planBlocked = /Blocked by Calendly plan|Standard, Teams, or Enterprise/i.test(
          message,
        );
        await upsertConnection({
          workspaceId,
          provider,
          config: { webhookSetupError: message, webhookCallbackUrl: url },
          mergeConfig: true,
        });
        return {
          ok: planBlocked,
          probe,
          durationMs: Date.now() - started,
          error: message,
          data: { planBlocked, url },
        };
      }
    }

    if (probe === "webhook_self_test") {
      if (provider !== "calendly") {
        return {
          ok: false,
          probe,
          durationMs: Date.now() - started,
          error: "webhook_self_test is Calendly-only",
        };
      }
      const { createHmac } = await import("crypto");
      const { externalWebhookUrl } = await import("./app-url");
      const { getConnection } = await import("@/lib/integrations/connections");
      const {
        resolveCalendlyWebhookSigningKeys,
        calendlyWebhookSigningKeyFingerprint,
      } = await import("../adapters/calendly");
      const conn = await getConnection(workspaceId, provider);
      const cfg = (conn?.configJson || {}) as Record<string, unknown>;
      const token =
        typeof cfg.webhookToken === "string" && cfg.webhookToken.trim()
          ? cfg.webhookToken.trim()
          : "";
      if (!token) {
        return {
          ok: false,
          probe,
          durationMs: Date.now() - started,
          error: "No webhook token — run Register webhooks first",
        };
      }
      const keys = resolveCalendlyWebhookSigningKeys(cfg);
      if (!keys.length) {
        return {
          ok: false,
          probe,
          durationMs: Date.now() - started,
          error: "No Calendly signing key in Coolify env / connection config",
        };
      }
      const rawBody = JSON.stringify({
        event: "invitee.created",
        payload: {
          email: "webhook-self-test@transovo.ai",
          name: "Webhook Self Test",
          uri: `https://api.calendly.com/scheduled_events/self-test/invitees/${Date.now()}`,
          status: "active",
          timezone: "America/New_York",
          scheduled_event: {
            uri: `https://api.calendly.com/scheduled_events/self-test-${Date.now()}`,
            name: "Webhook Self Test",
            status: "active",
            start_time: new Date(Date.now() + 86400000).toISOString(),
            end_time: new Date(Date.now() + 86400000 + 1800000).toISOString(),
          },
        },
      });
      const t = String(Math.floor(Date.now() / 1000));
      const v1 = createHmac("sha256", keys[0]).update(`${t}.${rawBody}`).digest("hex");
      const url = externalWebhookUrl("calendly", token);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Calendly-Webhook-Signature": `t=${t},v1=${v1}`,
          "User-Agent": "Transovo-Webhook-Self-Test/1.0",
        },
        body: rawBody,
      });
      const text = await res.text();
      let json: unknown = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = text.slice(0, 300);
      }
      await writeIntegrationAudit({
        workspaceId,
        provider,
        category: "diagnostics",
        action: "probe_webhook_self_test",
        message: `Self-test ${res.status} fingerprint=${calendlyWebhookSigningKeyFingerprint(cfg)}`,
        actorUserId,
      });
      return {
        ok: res.status === 200,
        probe,
        durationMs: Date.now() - started,
        data: {
          status: res.status,
          url,
          fingerprint: calendlyWebhookSigningKeyFingerprint(cfg),
          body: json,
        },
        error: res.status === 200 ? undefined : `Webhook self-test HTTP ${res.status}`,
      };
    }

    return { ok: false, probe, durationMs: Date.now() - started, error: "Unknown probe" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await writeIntegrationAudit({
      workspaceId,
      provider,
      category: "diagnostics",
      action: `probe_${probe}`,
      message,
      actorUserId,
    });
    return { ok: false, probe, durationMs: Date.now() - started, error: message };
  }
}
