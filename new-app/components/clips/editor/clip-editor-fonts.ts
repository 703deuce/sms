import { Archivo_Black, Bangers, Bebas_Neue, Inter, Lato, Luckiest_Guy, Oswald } from 'next/font/google'

/**
 * E4fix: the caption / text display fonts that lib/clips/caption-fonts.ts references as
 * `var(--font-clip-*)`. Before this only Anton / Montserrat / Poppins were loaded (editor-shell), so
 * Bangers, Bebas Neue, Archivo Black, Luckiest Guy, Inter, Lato and Oswald fell back to a system
 * sans in the preview. Faces match the files the worker bundles (worker/v3/fonts/t6): single
 * weight 400 display faces, Lato Black (900), Inter / Oswald variable.
 */
const bangers = Bangers({ subsets: ['latin'], weight: '400', variable: '--font-clip-bangers', display: 'swap' })
const bebas = Bebas_Neue({ subsets: ['latin'], weight: '400', variable: '--font-clip-bebas', display: 'swap' })
const archivo = Archivo_Black({ subsets: ['latin'], weight: '400', variable: '--font-clip-archivo', display: 'swap' })
const luckiest = Luckiest_Guy({ subsets: ['latin'], weight: '400', variable: '--font-clip-luckiest', display: 'swap' })
const inter = Inter({ subsets: ['latin'], variable: '--font-clip-inter', display: 'swap' })
const lato = Lato({ subsets: ['latin'], weight: ['900'], variable: '--font-clip-lato', display: 'swap' })
const oswald = Oswald({ subsets: ['latin'], variable: '--font-clip-oswald', display: 'swap' })

/** Class names that define every `--font-clip-*` display-font variable (put on the editor root). */
export const clipDisplayFontVars = [bangers, bebas, archivo, luckiest, inter, lato, oswald]
  .map((f) => f.variable)
  .join(' ')

/**
 * Portaled UI (Select popups for the font pickers, dialogs) renders under <body>, outside the editor
 * root, so the font variables are also put on <body> while the editor is mounted.
 */
export function addFontVarsToBody(classNames: string): () => void {
  if (typeof document === 'undefined') return () => {}
  const cls = classNames.split(/\s+/).filter(Boolean)
  document.body.classList.add(...cls)
  return () => document.body.classList.remove(...cls)
}
