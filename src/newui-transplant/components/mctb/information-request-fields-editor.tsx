'use client'

import type { MctbSmsCollectFieldDef } from '@/lib/mctb/lead-recovery/types'
import { newCustomSmsCollectField } from '@/lib/mctb/ai-recovery/collect-field-schema'
import { ConfigSection } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import { Checkbox } from '@/newui-transplant/components/ui/checkbox'
import { Input } from '@/newui-transplant/components/ui/input'
import { Plus, Trash2 } from 'lucide-react'

export function InformationRequestFieldsEditor({
  fields,
  onChange,
}: {
  fields: MctbSmsCollectFieldDef[]
  onChange: (next: MctbSmsCollectFieldDef[]) => void
}) {
  function patchRow(index: number, patch: Partial<MctbSmsCollectFieldDef>) {
    onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)))
  }

  function addCustom() {
    onChange([...fields, newCustomSmsCollectField('', fields.length + 1)])
  }

  function removeCustom(index: number) {
    const row = fields[index]
    if (row?.source !== 'custom') return
    onChange(fields.filter((_, i) => i !== index))
  }

  return (
    <ConfigSection
      title="Information to request"
      description="Callers see this as one natural sentence in your first text. Their reply is shown to you verbatim — no AI extraction required."
      insetClassName="space-y-3"
    >
      <ul className="divide-y rounded-lg border bg-card/50">
        {fields.map((field, index) => (
          <li key={field.id} className="flex flex-wrap items-start gap-3 px-3 py-3">
            <Checkbox
              checked={field.enabled}
              onCheckedChange={() => patchRow(index, { enabled: !field.enabled })}
              aria-label={`Request ${field.label}`}
              className="mt-2"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <span className="text-sm font-medium text-foreground">{field.label}</span>
              {field.source === 'custom' ? (
                <Input
                  value={field.label}
                  onChange={(e) => patchRow(index, { label: e.target.value })}
                  aria-label="Custom information label"
                  placeholder="e.g. Type of water heater"
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Included in the reply prompt automatically.
                </p>
              )}
            </div>
            {field.source === 'custom' ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeCustom(index)}
                aria-label={`Remove ${field.label}`}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <Button type="button" variant="outline" size="sm" onClick={addCustom}>
        <Plus className="mr-1 size-4" aria-hidden />
        Add custom item
      </Button>
    </ConfigSection>
  )
}
