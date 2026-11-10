import { AdStudioPage } from '../../../components/ad-studio/ad-studio-page'

export const metadata = { title: 'Ad Studio' }

export default function AdStudioRoute() {
  console.info('[ad-studio:ui] load', { step: 'route' })
  return <AdStudioPage />
}
