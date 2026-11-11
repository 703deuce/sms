import { TemplateModerationQueue } from '@/components/clips/templates/template-moderation-queue'

export const metadata={title:'Template moderation · Clips'}
export const dynamic='force-dynamic'

export default function TemplateModerationPage(){
  return <TemplateModerationQueue />
}
