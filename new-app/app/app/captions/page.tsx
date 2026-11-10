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
        description="Upload a video, transcribe speech, style captions in the existing compact editor, and export a burned-in MP4, SRT, or VTT."
      />
      <AiCaptionsWorkspace />
    </PageContainer>
  )
}
