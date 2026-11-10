/**
 * Permanent (308) redirects for the #1126 app route restructure.
 * Imported by next.config.mjs and by unit tests. More-specific sources come first.
 */
export const appRouteRedirects = [
  {
    source: '/app/clips/video/new',
    destination: '/app/ai-video/new',
    permanent: true,
  },
  {
    source: '/app/clips/video/templates',
    destination: '/app/ai-video/templates',
    permanent: true,
  },
  {
    source: '/app/clips/video',
    destination: '/app/ai-video/new',
    permanent: true,
  },
  {
    source: '/app/clips/:projectId/video',
    destination: '/app/ai-video/:projectId',
    permanent: true,
  },
  {
    source: '/app/clips/:projectId/edit/:clipId',
    destination: '/app/video-editor/:projectId/edit/:clipId',
    permanent: true,
  },
  {
    source: '/app/clips/:projectId/studio/:clipId',
    destination: '/app/video-editor/:projectId/studio/:clipId',
    permanent: true,
  },
  {
    source: '/app/clips/:projectId/script',
    destination: '/app/video-editor/:projectId/script',
    permanent: true,
  },
  {
    source: '/app/clips/new',
    has: [{ type: 'query', key: 'intent', value: 'full' }],
    destination: '/app/video-editor/new',
    permanent: true,
  },
  {
    source: '/app/editor/:path*',
    destination: '/app/video-editor/:path*',
    permanent: true,
  },
  {
    source: '/app/editor',
    destination: '/app/video-editor',
    permanent: true,
  },
  {
    source: '/app/home',
    destination: '/app',
    permanent: true,
  },
  {
    source: '/app/dashboard',
    destination: '/app',
    permanent: true,
  },
  {
    source: '/app/dashboard/',
    destination: '/app',
    permanent: true,
  },
]

function sourceToRegex(source) {
  const names = []
  const body = source
    .split('/')
    .map((seg) => {
      if (!seg) return ''
      if (seg.startsWith(':') && seg.endsWith('*')) {
        names.push(seg.slice(1, -1))
        return '(.*)'
      }
      if (seg.startsWith(':')) {
        names.push(seg.slice(1))
        return '([^/]+)'
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    })
    .join('/')
  return { re: new RegExp(`^${body}$`), names }
}

function hasQuery(rule, params) {
  if (!rule.has) return true
  return rule.has.every((cond) => {
    if (cond.type !== 'query') return false
    return params.get(cond.key) === cond.value
  })
}

/**
 * Apply the 308 table the same way next.config will: first matching rule wins,
 * path params are substituted, and the request query string is preserved
 * (including a leftover intent=full, which the spec allows).
 *
 * @param {string} pathname
 * @param {string} [search]
 * @returns {{ status: 308, location: string } | null}
 */
export function applyAppRouteRedirect(pathname, search = '') {
  const path = pathname.replace(/\/+$/, '') || '/'
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  for (const rule of appRouteRedirects) {
    if (!hasQuery(rule, params)) continue
    const { re, names } = sourceToRegex(rule.source)
    const m = re.exec(path)
    if (!m) continue
    let dest = rule.destination
    names.forEach((name, i) => {
      dest = dest.replace(new RegExp(`:${name}\\*?`, 'g'), m[i + 1] ?? '')
    })
    const q = params.toString()
    return { status: 308, location: q ? `${dest}?${q}` : dest }
  }
  return null
}

export const STAY_PATHS = [
  '/app/clips',
  '/app/clips/new',
  '/app/clips/proj_1',
  '/app/clips/brand',
  '/app/clips/media',
  '/app/clips/templates',
  '/app/clips/trash',
  '/app/exports',
  '/app/streamer',
  '/app/rooms',
  '/app/record',
  '/app/settings',
  '/app/help',
  '/app/integrations',
]
