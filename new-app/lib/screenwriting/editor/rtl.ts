export function elementDirection(rtl: boolean): { direction: 'rtl' | 'ltr'; textAlign: 'right' | 'left' } {
  return rtl ? { direction: 'rtl', textAlign: 'right' } : { direction: 'ltr', textAlign: 'left' }
}
