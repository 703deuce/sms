import { cn } from '@/lib/utils'

const SIZES: Record<string, string> = {
  '9:16': 'h-5 w-3',
  '1:1': 'size-4',
  '16:9': 'h-3 w-5',
  '4:5': 'h-5 w-4',
}

export function AspectGlyph({ ratio, className }: { ratio: string; className?: string }) {
  const size = SIZES[ratio] ?? 'h-4 w-4'
  return (
    <span
      className={cn('inline-block shrink-0 rounded-[3px] border-2 border-current', size, className)}
      aria-hidden
    />
  )
}
