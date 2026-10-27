import { listT2vTemplates } from '@/lib/server/t2v/routes/templates'
import { t2vFeatureDisabledResponse } from '@/lib/server/t2v/t2v-api-guard'

export async function GET(request: Request) {
  const disabled = t2vFeatureDisabledResponse()
  if (disabled) return disabled
  const url = new URL(request.url)
  return listT2vTemplates({
    category: url.searchParams.get('category') ?? undefined,
    aspect: url.searchParams.get('aspect') ?? undefined,
  })
}
