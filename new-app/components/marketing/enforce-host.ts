import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { APP_ROOT_REDIRECT, isMarketingHost } from './hosts'

function requestHost(h: Headers): string | null {
  return h.get('x-forwarded-host') || h.get('host')
}

/** True when this request's Host / X-Forwarded-Host is on the marketing allow-list. */
export async function isCurrentRequestMarketingHost(): Promise<boolean> {
  return isMarketingHost(requestHost(await headers()))
}

/** `/` on a non-marketing host keeps today's redirect into the app. */
export async function redirectNonMarketingRoot(): Promise<void> {
  if (!(await isCurrentRequestMarketingHost())) {
    redirect(APP_ROOT_REDIRECT)
  }
}

/** `/ai-clips` and `/video-editing` do not exist on voice / other app hosts. */
export async function notFoundUnlessMarketingHost(): Promise<void> {
  if (!(await isCurrentRequestMarketingHost())) {
    notFound()
  }
}
