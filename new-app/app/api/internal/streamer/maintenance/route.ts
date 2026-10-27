import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { encryptIntegrationSecret } from '@/lib/integrations/framework/secrets'
import { verifyWorkerHmac } from '@/lib/server/clips/worker-auth'
import { getPrisma } from '@/lib/server/db'
import { reapStaleJobs } from '@/lib/server/clips/jobs'
import {
  decryptKickToken,
  ensureKickEventSubscriptions,
  kickSubscriptionsDue,
  refreshKickUserToken,
} from '@/lib/server/streamer/kick'
import { mergePlatformState } from '@/lib/server/streamer/platform-state'
import {
  decryptTwitchToken,
  ensureTwitchEventsubForBroadcaster,
  refreshTwitchUserToken,
  twitchAppAccessToken,
  twitchSubscriptionsDue,
} from '@/lib/server/streamer/twitch'

function isTransientHttp(status: number): boolean {
  return status === 429 || status >= 500
}

export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyWorkerHmac(request, raw)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const prisma = getPrisma()
  const errors: string[] = []
  const result = {
    validated: 0,
    refreshed: 0,
    eventsubRecreated: 0,
    pruned: false,
    reaped: 0,
    errors,
  }

  try {
    const cutoffEvents = new Date(Date.now() - 7 * 86400_000)
    const cutoffChat = new Date(Date.now() - 30 * 86400_000)
    await prisma.streamWebhookEvent.deleteMany({ where: { receivedAt: { lt: cutoffEvents } } })
    await prisma.streamChatLine.deleteMany({ where: { at: { lt: cutoffChat } } })
    result.pruned = true
  } catch (err) {
    errors.push(`prune: ${err instanceof Error ? err.message : String(err)}`)
  }

  try {
    const twitchChannels = await prisma.streamChannel.findMany({
      where: { platform: 'twitch', status: 'CONNECTED', deletedAt: null, connectionId: { not: null } },
    })
    let validated = 0
    let refreshed = 0
    for (const ch of twitchChannels) {
      if (!ch.connectionId || !ch.externalId) continue
      try {
        const conn = await prisma.integrationConnection.findUnique({ where: { id: ch.connectionId } })
        const access = decryptTwitchToken(conn?.accessToken)
        const refresh = decryptTwitchToken(conn?.refreshToken)
        if (!access) continue
        const res = await fetch('https://id.twitch.tv/oauth2/validate', {
          headers: { Authorization: `OAuth ${access}` },
        })
        if (isTransientHttp(res.status)) {
          errors.push(`twitch_validate_transient ${ch.id}: ${res.status}`)
          continue
        }
        if (res.ok) {
          validated += 1
          const ps = (ch.platformState as Record<string, unknown>) || {}
          const checkedAt = typeof ps.eventsubCheckedAt === 'string' ? ps.eventsubCheckedAt : undefined
          if (twitchSubscriptionsDue(checkedAt)) {
            try {
              const ids = Array.isArray(ps.eventsubIds) ? (ps.eventsubIds as string[]) : []
              const nextIds = await ensureTwitchEventsubForBroadcaster(ch.externalId, ids)
              if (nextIds.length !== ids.length) refreshed += 1
              await prisma.streamChannel.update({
                where: { id: ch.id },
                data: {
                  platformState: mergePlatformState(ch.platformState, {
                    eventsubIds: nextIds,
                    eventsubCheckedAt: new Date().toISOString(),
                  }) as Prisma.InputJsonValue,
                },
              })
            } catch (subErr) {
              errors.push(`eventsub ${ch.id}: ${subErr instanceof Error ? subErr.message : String(subErr)}`)
            }
          }
          continue
        }
        if (!refresh) {
          if (res.status === 401 || res.status === 400) {
            await prisma.streamChannel.update({
              where: { id: ch.id },
              data: { status: 'NEEDS_REAUTH', autoProcess: false },
            })
          }
          continue
        }
        try {
          const tokens = await refreshTwitchUserToken(refresh)
          const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)
          await prisma.integrationConnection.update({
            where: { id: ch.connectionId },
            data: {
              accessToken: encryptIntegrationSecret(tokens.access_token),
              refreshToken: encryptIntegrationSecret(tokens.refresh_token ?? refresh),
              expiresAt,
              status: 'connected',
            },
          })
          refreshed += 1
          validated += 1
        } catch (refreshErr) {
          const msg = refreshErr instanceof Error ? refreshErr.message : String(refreshErr)
          const authFail = /\b(400|401)\b/.test(msg) || /invalid.*token/i.test(msg)
          if (authFail) {
            await prisma.streamChannel.update({
              where: { id: ch.id },
              data: { status: 'NEEDS_REAUTH', autoProcess: false },
            })
          }
          errors.push(`twitch_refresh ${ch.id}: ${msg}`)
        }
      } catch (chErr) {
        errors.push(`twitch_channel ${ch.id}: ${chErr instanceof Error ? chErr.message : String(chErr)}`)
      }
    }
    result.validated = validated
    result.refreshed = refreshed
  } catch (err) {
    errors.push(`twitch_validate: ${err instanceof Error ? err.message : String(err)}`)
  }

  try {
    const kickChannels = await prisma.streamChannel.findMany({
      where: { platform: 'kick', status: 'CONNECTED', deletedAt: null, connectionId: { not: null } },
    })
    for (const ch of kickChannels) {
      if (!ch.connectionId || !ch.externalId) continue
      try {
        const conn = await prisma.integrationConnection.findUnique({ where: { id: ch.connectionId } })
        const refresh = decryptKickToken(conn?.refreshToken)
        const expiresAt = conn?.expiresAt
        const needsRefresh = expiresAt && expiresAt.getTime() < Date.now() + 3600_000
        if (needsRefresh && refresh) {
          try {
            const tokens = await refreshKickUserToken(refresh)
            await prisma.integrationConnection.update({
              where: { id: ch.connectionId },
              data: {
                accessToken: encryptIntegrationSecret(tokens.access_token),
                refreshToken: encryptIntegrationSecret(tokens.refresh_token ?? refresh),
                expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
                status: 'connected',
              },
            })
          } catch (kickRefreshErr) {
            const msg = kickRefreshErr instanceof Error ? kickRefreshErr.message : String(kickRefreshErr)
            const authFail = /\b(400|401)\b/.test(msg)
            if (authFail) {
              await prisma.streamChannel.update({
                where: { id: ch.id },
                data: { status: 'NEEDS_REAUTH', autoProcess: false },
              })
            }
            errors.push(`kick_refresh ${ch.id}: ${msg}`)
          }
        }
        const ps = (ch.platformState as Record<string, unknown>) || {}
        const checkedAt =
          typeof ps.kickSubscriptionsCheckedAt === 'string' ? ps.kickSubscriptionsCheckedAt : undefined
        if (kickSubscriptionsDue(checkedAt)) {
          try {
            const ids = Array.isArray(ps.kickSubIds) ? (ps.kickSubIds as string[]) : []
            const bid = Number(ch.externalId)
            if (!Number.isNaN(bid)) {
              const nextIds = await ensureKickEventSubscriptions(bid, ids)
              await prisma.streamChannel.update({
                where: { id: ch.id },
                data: {
                  platformState: mergePlatformState(ch.platformState, {
                    kickSubIds: nextIds,
                    kickSubscriptionsCheckedAt: new Date().toISOString(),
                  }) as Prisma.InputJsonValue,
                },
              })
            }
          } catch (subErr) {
            errors.push(`kick_subs ${ch.id}: ${subErr instanceof Error ? subErr.message : String(subErr)}`)
          }
        }
      } catch (chErr) {
        errors.push(`kick_channel ${ch.id}: ${chErr instanceof Error ? chErr.message : String(chErr)}`)
      }
    }
  } catch (err) {
    errors.push(`kick_maint: ${err instanceof Error ? err.message : String(err)}`)
  }

  try {
    await twitchAppAccessToken()
  } catch {
    /* non-fatal */
  }

  try {
    result.reaped = await reapStaleJobs()
  } catch (err) {
    errors.push(`reaper: ${err instanceof Error ? err.message : String(err)}`)
    return NextResponse.json({ error: 'Reaper failed', data: result }, { status: 500 })
  }

  return NextResponse.json({ data: result })
}
