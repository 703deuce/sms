import { Captions } from 'lucide-react'
import { PageContainer, PageHeader } from '../../../components/app/page-primitives'
import { AiCaptionsWorkspace } from '../../../components/captions/ai-captions-workspace'

export const metadata = { title: 'AI Captions' }

export default function AiCaptionsPage() {
  return (
    <PageContainer>
      <PageHeader
        icon={Captions}
        iconTone="brand"
        title="AI Captions"
        description="Upload a finished video to transcribe and caption it. When it is ready, preview the result, download it, or open the clip editor on the Captions tab."
      />
      <AiCaptionsWorkspace />
    </PageContainer>
  )
}
