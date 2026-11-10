import { UnifiedClipProgress } from '@/components/clips/unified-clip-progress'

export default function ClipProjectLoading() {
  return (
    <div className="space-y-6 p-4 md:p-6" aria-busy aria-label="Starting clip run" data-testid="clip-project-starting">
      <UnifiedClipProgress stage="Starting" />
    </div>
  )
}
