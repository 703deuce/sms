import 'server-only'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth/session'
import { viewerCanAccessGatedShare } from '@/lib/server/clips/composition-access'
import { recordPublishView } from '@/lib/server/clips/publish-views'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'

const VIEW_SESSION_COOKIE = 'tv_publish_view_session'
const VIEW_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30

function accessBlocked(settings: Record<string, unknown>, embed: boolean, signedIn: boolean, hasAccess: boolean) {
  const needsSignIn =
    (embed && settings.requireSignInToEmbed === true) || settings.requireSignInToView === true
  if (!needsSignIn) return false
  return !signedIn || !hasAccess
}

export async function handlePublicPublishViewBeacon(
  publishId: string,
  compositionId: string,
  workspaceId: string,
  request: Request,
) {
  const prisma = getPrisma()
  const pub = await prisma.scriptCompositionPublish.findUnique({ where: { id: publishId } })
  if (!pub || pub.compositionId !== compositionId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const settings = (pub.settings ?? {}) as Record<string, unknown>
  const url = new URL(request.url)
  const embed = url.searchParams.get('embed') === '1'
  const authUser = await getAuthenticatedUser(request)
  const hasAccess =
    authUser != null ? await viewerCanAccessGatedShare(workspaceId, compositionId, authUser.id) : false

  if (accessBlocked(settings, embed, authUser != null, hasAccess)) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 403 })
  }

  const cookieStore = await cookies()
  let sessionKey = cookieStore.get(VIEW_SESSION_COOKIE)?.value?.trim()
  if (!sessionKey) {
    sessionKey = createId('pvs')
  }

  const label = authUser?.email ?? authUser?.supabaseUser?.email ?? null
  const result = await recordPublishView({
    publishId,
    compositionId,
    workspaceId,
    viewerSessionKey: sessionKey,
    viewerUserId: authUser?.id,
    viewerLabel: label,
  })

  const res = NextResponse.json({ data: { viewCount: result.viewCount, counted: result.counted } })
  if (!cookieStore.get(VIEW_SESSION_COOKIE)?.value) {
    res.cookies.set(VIEW_SESSION_COOKIE, sessionKey, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: VIEW_SESSION_MAX_AGE_SEC,
      path: '/',
    })
  }
  return res
}

export async function resolvePublishForShareLink(linkId: string) {
  const prisma = getPrisma()
  const link = await prisma.scriptCompositionShareLink.findFirst({
    where: { id: linkId, revokedAt: null },
    include: { composition: true },
  })
  if (!link || link.linkAccess === 'INVITE_ONLY') return null
  const publish = await prisma.scriptCompositionPublish.findUnique({ where: { compositionId: link.compositionId } })
  if (!publish) return null
  return {
    publishId: publish.id,
    compositionId: link.compositionId,
    workspaceId: link.workspaceId,
  }
}

export async function resolvePublishForSlug(slug: string) {
  const prisma = getPrisma()
  const pub = await prisma.scriptCompositionPublish.findUnique({ where: { publicSlug: slug } })
  if (!pub) return null
  return { publishId: pub.id, compositionId: pub.compositionId, workspaceId: pub.workspaceId }
}
