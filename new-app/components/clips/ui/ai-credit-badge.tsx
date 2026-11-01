import { Badge } from '@/components/ui/badge'
import { creditsLabel } from '@/lib/clips/credit-cost'

/** Paid AI tool chip (credits only — never provider $). */
export function AiCreditBadge({ credits = 1 }: { credits?: number }) {
  return (
    <Badge variant="outline" className="text-[10px] font-normal">
      {creditsLabel(credits)}
    </Badge>
  )
}
