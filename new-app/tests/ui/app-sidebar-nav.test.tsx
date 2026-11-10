// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type React from 'react'
import { render } from '@testing-library/react'
import { AppSidebar } from '@/components/shell/app-sidebar'
import { SidebarProvider } from '@/components/ui/sidebar'
import { SIDEBAR_HIDDEN_HREFS } from '@/lib/sidebar-nav'

const pathnameRef = { current: '/app/clips' }
const searchRef = { current: new URLSearchParams() }

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameRef.current,
  useSearchParams: () => searchRef.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : String(href)} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock('@/components/providers/clips-workspace-provider', () => ({
  useClipsWorkspace: () => ({ testMode: false }),
}))

vi.mock('@/lib/recording/use-recording-enabled', () => ({
  useRecordingEnabled: () => true,
  useSoloRecordingEnabled: () => false,
}))

vi.mock('@/components/drive/drive-workspace-switcher', () => ({
  DriveWorkspaceSwitcher: () => <span data-testid="workspace-stub">ws</span>,
}))

vi.mock('@/hooks/use-clips-folders', () => ({
  useClipsFolders: () => ({ folders: [] }),
}))

vi.mock('@/lib/features/t2v', () => ({
  isT2vFeatureEnabled: () => true,
}))

vi.mock('@/lib/features/script-editor', () => ({
  isScriptEditorEnabled: () => false,
}))

function navOrder(container: HTMLElement) {
  return [...container.querySelectorAll('[data-nav-id]')].map((el) => el.getAttribute('data-nav-id'))
}

function isIconHidden(el: Element): boolean {
  let node: Element | null = el
  while (node) {
    const cn = node.className
    if (typeof cn === 'string' && cn.includes('group-data-[collapsible=icon]:hidden')) return true
    if (node.hasAttribute('hidden')) return true
    if (node.getAttribute('data-state') === 'closed') return true
    node = node.parentElement
  }
  return false
}

describe('AppSidebar nav', () => {
  beforeEach(() => {
    pathnameRef.current = '/app/clips'
    searchRef.current = new URLSearchParams()
  })

  it('renders nav order and hides forbidden hrefs', () => {
    const { container } = render(
      <SidebarProvider defaultOpen>
        <AppSidebar recordingNavEnabled />
      </SidebarProvider>,
    )
    expect(navOrder(container)).toEqual([
      'workspace-switcher',
      'home',
      'clips',
      'streamer',
      'editor',
      'youtube-video',
      'record',
      'ai-video',
      'studio',
      'media',
      'brand',
      'templates',
      'exports',
      'learn',
      'settings',
    ])
    const navAnchors = [...container.querySelectorAll('[data-nav-id] a[href]')]
    const templatesLinks = [...container.querySelectorAll('a[href^="/app/clips/templates"]')]
    expect(templatesLinks).toHaveLength(1)
    expect(templatesLinks[0]?.closest('[data-nav-id]')?.getAttribute('data-nav-id')).toBe('templates')
    for (const h of SIDEBAR_HIDDEN_HREFS) {
      expect(navAnchors.some((a) => a.getAttribute('href') === h)).toBe(false)
    }
  })

  it('active states for home, ai-video, templates, brand', () => {
    const cases: [string, URLSearchParams, string][] = [
      ['/app/clips', new URLSearchParams('kind=video'), 'ai-video'],
      ['/app/clips', new URLSearchParams(), 'home'],
      ['/app/clips/templates', new URLSearchParams('tab=ai-video'), 'templates'],
      ['/app/clips/brand', new URLSearchParams('tab=templates'), 'brand'],
    ]
    for (const [path, params, id] of cases) {
      pathnameRef.current = path
      searchRef.current = params
      const { container, unmount } = render(
        <SidebarProvider defaultOpen>
          <AppSidebar recordingNavEnabled />
        </SidebarProvider>,
      )
      const active = container.querySelectorAll('[data-nav-id][aria-current="page"]')
      expect(active.length, `${path}?${params}`).toBe(1)
      expect(active[0]?.closest('[data-nav-id]')?.getAttribute('data-nav-id')).toBe(id)
      unmount()
    }
  })

  it('icon mode keeps all nav items visible', () => {
    const { container } = render(
      <SidebarProvider defaultOpen={false}>
        <AppSidebar recordingNavEnabled />
      </SidebarProvider>,
    )
    const ids = ['home', 'clips', 'streamer', 'editor', 'record', 'ai-video', 'media', 'brand', 'templates', 'exports', 'learn', 'settings']
    for (const id of ids) {
      const el = container.querySelector(`[data-nav-id="${id}"]`)
      expect(el, id).toBeTruthy()
      expect(isIconHidden(el!), id).toBe(false)
    }
  })
})
