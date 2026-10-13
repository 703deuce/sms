import type { ReactNode } from 'react'
import { isUnifiedAppointmentsExperience } from '@/lib/products/unified-appointments'

/** Renders the Opus scheduling page or the legacy page — two separate implementations, not a visual wrapper. */
export function SchedulingPageGate({ opus, legacy }: { opus: ReactNode; legacy: ReactNode }) {
  return isUnifiedAppointmentsExperience() ? opus : legacy
}
