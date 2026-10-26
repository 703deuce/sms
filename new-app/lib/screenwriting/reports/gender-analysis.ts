export interface GenderStat {
  label: string
  count: number
}

export function genderAnalysisFromNames(names: string[]): GenderStat[] {
  const femaleEndings = /(a|ia|ette|ine)$/i
  let f = 0
  let m = 0
  let u = 0
  for (const n of names) {
    const first = n.split(/\s+/)[0] || n
    if (femaleEndings.test(first)) f++
    else if (/^[A-Z]+$/.test(first)) u++
    else m++
  }
  return [
    { label: 'masculine-coded', count: m },
    { label: 'feminine-coded', count: f },
    { label: 'neutral/unknown', count: u },
  ]
}
