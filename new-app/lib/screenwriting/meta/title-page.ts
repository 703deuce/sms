import { z } from 'zod'

export const titlePageSchema = z.object({
  title: z.string().optional(),
  credit: z.string().optional(),
  authors: z.string().optional(),
  source: z.string().optional(),
  draftDate: z.string().optional(),
  contact: z.string().optional(),
  copyright: z.string().optional(),
  wga: z.string().optional(),
})

export type TitlePage = z.infer<typeof titlePageSchema>

export function titlePageToFountainKeys(tp: TitlePage): Record<string, string> {
  const out: Record<string, string> = {}
  if (tp.title) out.Title = tp.title
  if (tp.credit) out.Credit = tp.credit
  if (tp.authors) out.Author = tp.authors
  if (tp.source) out.Source = tp.source
  if (tp.draftDate) out['Draft date'] = tp.draftDate
  if (tp.contact) out.Contact = tp.contact
  if (tp.copyright) out.Copyright = tp.copyright
  if (tp.wga) out['WGA Registration #'] = tp.wga
  return out
}
