import type { NumberProduct } from '@/lib/numbers'

/**
 * Product launch gate: Missed Call Text Back is implemented but not offered in UI.
 * Set to true (or NEXT_PUBLIC_MCTB_UI_ENABLED=true) when re-enabling nav and settings.
 */
export const MCTB_UI_ENABLED = process.env.NEXT_PUBLIC_MCTB_UI_ENABLED === 'true'

export function numberProductsForUi(products: readonly NumberProduct[]): NumberProduct[] {
  if (MCTB_UI_ENABLED) return [...products]
  return products.filter((p) => p !== 'mctb')
}

export function connectWizardProductsForUi(): Array<'receptionist' | 'mctb'> {
  return MCTB_UI_ENABLED ? ['receptionist', 'mctb'] : ['receptionist']
}
