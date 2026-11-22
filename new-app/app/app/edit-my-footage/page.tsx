import {notFound} from 'next/navigation'
import {isByoFeatureEnabled} from '@/lib/server/clips/feature-gates'
import {ByoCreate} from '@/components/motion-studio/byo-create'
export const metadata={title:'Edit My Footage · Transovo'}
export default function EditMyFootagePage(){if(!isByoFeatureEnabled())notFound();return <ByoCreate/>}
