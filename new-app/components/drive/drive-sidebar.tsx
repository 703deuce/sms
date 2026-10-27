'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  Clock,
  Download,
  GraduationCap,
  House,
  Images,
  LayoutTemplate,
  Lock,
  Palette,
  Plus,
  Share2,
  Sparkles,
  Users,
  Video,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type FolderRow = { id: string; name: string }

export function DriveSidebar({
  folders,
  onNewFolder,
}: {
  folders: FolderRow[]
  onNewFolder?: () => void
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const view = searchParams.get('view') ?? 'home'

  const item = (href: string, label: string, icon: React.ReactNode, active: boolean) => (
    <Link
      href={href}
      className={cn(
        'flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] transition-colors',
        active ? 'bg-accent font-medium text-accent-foreground' : 'hover:bg-accent/60',
        active && 'border-l-2 border-primary pl-[6px]',
      )}
    >
      <span className="size-4 shrink-0 opacity-80">{icon}</span>
      {label}
    </Link>
  )

  const onClips = pathname.startsWith('/app/clips')

  return (
    <aside
      className="hidden w-[232px] shrink-0 flex-col border-r border-border bg-background py-3 pl-3 pr-2 md:flex"
      data-testid="drive-sidebar"
      aria-label="Create and library"
    >
      <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Create</p>
      {item('/app/clips', 'Home', <House className="size-4" />, onClips && view === 'home' && !pathname.includes('/trash'))}
      {item('/app/clips/new', 'New project', <Sparkles className="size-4" />, pathname === '/app/clips/new')}

      <p className="mb-1 mt-4 flex items-center justify-between px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Library
        {onNewFolder && (
          <Button type="button" variant="ghost" size="icon-sm" className="size-5" onClick={onNewFolder} title="New folder">
            <Plus className="size-3.5" />
          </Button>
        )}
      </p>
      {item('/app/clips?view=recents', 'Recents', <Clock className="size-4" />, view === 'recents')}
      {item('/app/clips?view=shared', 'Shared with me', <Share2 className="size-4" />, view === 'shared')}
      {item('/app/clips/trash', 'Trash', <Download className="size-4" />, pathname.includes('/trash'))}
      {folders.map((f) =>
        item(`/app/clips?folder=${f.id}`, f.name, <Lock className="size-4" />, searchParams.get('folder') === f.id),
      )}

      <p className="mb-1 mt-4 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Brand</p>
      {item('/app/clips/brand', 'Brand Studio', <Palette className="size-4" />, pathname.startsWith('/app/clips/brand'))}

      <p className="mb-1 mt-4 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Tools</p>
      {item('/app/clips/media', 'Media library', <Images className="size-4" />, pathname.includes('/media'))}
      {item('/app/rooms', 'Rooms recordings', <Video className="size-4" />, pathname.startsWith('/app/rooms'))}
      {item('/app/clips?view=workspaces', 'Workspaces', <Users className="size-4" />, view === 'workspaces')}
      {item('/app/clips?view=layouts', 'Layout packs', <LayoutTemplate className="size-4" />, view === 'layouts')}
      {item('https://transovo.ai/help/clips', 'Learn', <GraduationCap className="size-4" />, false)}
    </aside>
  )
}
