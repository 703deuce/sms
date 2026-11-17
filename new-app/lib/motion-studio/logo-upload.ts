/** Safely convert an SVG logo to PNG before using the existing photo upload API.
 * No SVG markup is stored or rendered as executable HTML by Motion Studio. */
export async function normalizeLogoUpload(file: File): Promise<File> {
  if (file.type !== 'image/svg+xml' && !/\.svg$/i.test(file.name)) return file
  if (file.size > 1024 * 1024) throw new Error('SVG logo must be under 1 MB.')
  const raw = await file.text()
  const xml = new DOMParser().parseFromString(raw, 'image/svg+xml')
  const root = xml.documentElement
  if (root.localName !== 'svg' || root.namespaceURI !== 'http://www.w3.org/2000/svg' || xml.querySelector('parsererror'))
    throw new Error('This is not a valid SVG logo.')
  const allowed = new Set(['svg','g','defs','symbol','use','path','rect','circle','ellipse','line','polyline',
    'polygon','text','tspan','linearGradient','radialGradient','stop','clipPath','mask','pattern','title','desc'])
  for (const el of Array.from(root.querySelectorAll('*')).concat(root)) {
    if (!allowed.has(el.localName)) throw new Error('This SVG contains unsupported embedded or interactive content. Export it as PNG.')
    for (const attr of Array.from(el.attributes)) {
      const name = attr.localName.toLowerCase()
      const value = attr.value.trim()
      if (name.startsWith('on') || name === 'href' && !value.startsWith('#') ||
        /(?:javascript:|data:|https?:|url\(\s*['"]?(?!#))/i.test(value))
        throw new Error('This SVG includes external or interactive content. Export it as PNG.')
    }
  }
  const parseDimension = (s: string | null) => {
    const n = Number.parseFloat(s || '')
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const viewBox = root.getAttribute('viewBox')?.split(/[\s,]+/).map(Number) || []
  const aspect = viewBox.length === 4 && viewBox[2]! > 0 && viewBox[3]! > 0 ? viewBox[2]! / viewBox[3]! : 1
  const width = Math.max(1, Math.min(2048, Math.round(parseDimension(root.getAttribute('width')) || 1024)))
  const height = Math.max(1, Math.min(2048, Math.round(parseDimension(root.getAttribute('height')) || width / aspect)))
  const serialized = new XMLSerializer().serializeToString(root)
  const objectUrl = URL.createObjectURL(new Blob([serialized], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Could not render SVG logo. Export it as PNG.'))
      image.src = objectUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not convert SVG logo.')
    ctx.drawImage(image, 0, 0, width, height)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      result => result ? resolve(result) : reject(new Error('Could not convert SVG logo.')), 'image/png'))
    return new File([blob], file.name.replace(/\.svg$/i, '') + '.png', { type: 'image/png' })
  } finally { URL.revokeObjectURL(objectUrl) }
}
