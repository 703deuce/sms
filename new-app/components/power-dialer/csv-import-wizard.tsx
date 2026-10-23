'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { guessCsvColumnMapping } from '@/lib/phone/csv-import-mapping'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SimpleSelect } from '@/components/app/filters'
import { importListCsv } from '@/lib/phone-api'

type Props = {
  listId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}

type PreviewRow = {
  lineNumber: number
  name?: string
  phones: { field: string; raw: string; e164: string | null }[]
  company?: string
  errors: string[]
}

export function CsvImportWizard({ listId, open, onOpenChange, onComplete }: Props) {
  const [step, setStep] = useState<'upload' | 'map' | 'confirm' | 'done'>('upload')
  const [csvText, setCsvText] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({
    phone: '',
    name: '',
    mobile: '',
    work: '',
    company: '',
    timezone: '',
  })
  const [duplicateBehavior, setDuplicateBehavior] = useState('add_to_list')
  const [result, setResult] = useState<{
    imported: number
    skipped: number
    updated: number
    rejected: { lineNumber: number; reason: string }[]
  } | null>(null)
  const [busy, setBusy] = useState(false)

  const headerOptions = useMemo(
    () => [{ value: '', label: '—' }, ...headers.map((h) => ({ value: h, label: h }))],
    [headers],
  )

  const previewDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refreshPreview = async (mappingOverride?: typeof mapping) => {
    if (!csvText) return
    const m = mappingOverride ?? mapping
    setBusy(true)
    try {
      const data = await importListCsv(listId, {
        csvText,
        mapping: {
          phone: m.phone,
          name: m.name,
          mobile: m.mobile,
          work: m.work,
          company: m.company,
          timezone: m.timezone,
          custom: {},
        },
        dryRun: true,
      }) as { headers?: string[]; preview: PreviewRow[] }
      if (data.headers?.length) setHeaders(data.headers)
      setPreview(data.preview)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preview failed')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (step !== 'map' || !csvText || !mapping.phone) return
    if (previewDebounce.current) clearTimeout(previewDebounce.current)
    previewDebounce.current = setTimeout(() => {
      void refreshPreview()
    }, 300)
    return () => {
      if (previewDebounce.current) clearTimeout(previewDebounce.current)
    }
  }, [step, csvText, mapping.phone, mapping.name, mapping.mobile, mapping.work, mapping.company, mapping.timezone, listId])

  const onFile = async (file: File | null) => {
    if (!file) return
    const text = await file.text()
    setCsvText(text)
    setStep('map')
    setBusy(true)
    try {
      const data = await importListCsv(listId, {
        csvText: text,
        mapping: { custom: {}, phone: '' },
        dryRun: true,
      }) as { headers: string[]; preview: PreviewRow[] }
      setHeaders(data.headers)
      const guessed = guessCsvColumnMapping(data.headers)
      const nextMapping = {
        phone: guessed.phone,
        name: guessed.name,
        mobile: '',
        work: '',
        company: guessed.company,
        timezone: '',
      }
      setMapping((m) => ({ ...m, ...nextMapping }))
      await refreshPreview(nextMapping)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not parse CSV')
      setStep('upload')
    } finally {
      setBusy(false)
    }
  }

  const runImport = async () => {
    if (!mapping.phone) {
      toast.error('Map a primary phone column')
      return
    }
    setBusy(true)
    try {
      const raw = await importListCsv(listId, {
        csvText,
        mapping: {
          phone: mapping.phone,
          name: mapping.name,
          mobile: mapping.mobile,
          work: mapping.work,
          company: mapping.company,
          timezone: mapping.timezone,
          custom: {},
        },
        duplicateBehavior: duplicateBehavior as 'skip' | 'update' | 'add_to_list',
        dryRun: false,
      }) as {
        imported: number
        updated?: number
        invalid?: number
        rejected: { lineNumber: number; reasons: string[] }[]
      }
      const data = {
        imported: raw.imported,
        skipped: raw.rejected.filter((r) => r.reasons.some((x) => x.includes('Duplicate'))).length,
        updated: raw.updated ?? 0,
        invalid: raw.invalid ?? raw.rejected.length,
        rejected: raw.rejected.map((r) => ({
          lineNumber: r.lineNumber,
          reason: r.reasons.join('; '),
        })),
      }
      setResult(data)
      setStep('done')
      toast.success(`Imported ${data.imported} contact(s)`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  const rejectedCsv = result?.rejected?.length
    ? ['line,reason', ...result.rejected.map((r) => `${r.lineNumber},"${r.reason.replace(/"/g, '""')}"`)].join('\n')
    : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import CSV</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">Upload a CSV file. Rows with validation errors are reported — nothing is silently dropped.</p>
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
          </div>
        )}

        {step === 'map' && (
          <div className="flex flex-col gap-3 text-sm">
            <SimpleSelect label="Phone (required)" value={mapping.phone} onChange={(v) => setMapping((m) => ({ ...m, phone: v }))} options={headerOptions} />
            <SimpleSelect label="Name" value={mapping.name} onChange={(v) => setMapping((m) => ({ ...m, name: v }))} options={headerOptions} />
            <SimpleSelect label="Mobile" value={mapping.mobile} onChange={(v) => setMapping((m) => ({ ...m, mobile: v }))} options={headerOptions} />
            <SimpleSelect label="Work phone" value={mapping.work} onChange={(v) => setMapping((m) => ({ ...m, work: v }))} options={headerOptions} />
            <SimpleSelect label="Company" value={mapping.company} onChange={(v) => setMapping((m) => ({ ...m, company: v }))} options={headerOptions} />
            <SimpleSelect
              label="Duplicate behavior"
              value={duplicateBehavior}
              onChange={setDuplicateBehavior}
              options={[
                { value: 'add_to_list', label: 'Add to list (skip if already on list)' },
                { value: 'skip', label: 'Skip existing contacts' },
                { value: 'update', label: 'Update existing contact fields' },
              ]}
            />
            {busy && <p className="text-xs text-muted-foreground">Updating preview…</p>}
            {preview.length > 0 && (
              <div className="max-h-40 overflow-auto rounded border text-xs">
                <table className="w-full">
                  <thead><tr className="border-b bg-muted/50"><th className="p-1">Line</th><th className="p-1">Phone</th><th className="p-1">Errors</th></tr></thead>
                  <tbody>
                    {preview.slice(0, 15).map((r) => (
                      <tr key={r.lineNumber} className="border-b">
                        <td className="p-1">{r.lineNumber}</td>
                        <td className="p-1">{r.phones[0]?.e164 || r.phones[0]?.raw || '—'}</td>
                        <td className="p-1 text-destructive">{r.errors.join('; ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {step === 'done' && result && (
          <div className="text-sm">
            <p>Imported: {result.imported} · Updated: {result.updated} · Skipped: {result.skipped}</p>
            {result.rejected.length > 0 && (
              <>
                <p className="mt-2 text-destructive">{result.rejected.length} row(s) rejected</p>
                <a
                  href={`data:text/csv;charset=utf-8,${encodeURIComponent(rejectedCsv)}`}
                  download="import-rejected.csv"
                  className="text-primary hover:underline"
                >
                  Download rejected rows
                </a>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'map' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
              <Button disabled={busy} onClick={() => void runImport()}>Import</Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={() => { onComplete(); onOpenChange(false) }}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
