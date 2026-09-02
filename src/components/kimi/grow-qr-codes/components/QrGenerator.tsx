'use client';
import { useState } from 'react';
import { QrCode as QrIcon, ChevronDown, Check, Download, Pipette, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { keywords, qrActions, webforms } from '../mock-data';
import QrCode from './QrCode';
import ColorPicker from './ColorPicker';

export default function QrGenerator({
  onCancel,
  defaultKeyword,
  keywordOptions,
  webformOptions,
  onDownload,
}: {
  onCancel: () => void;
  defaultKeyword?: string;
  keywordOptions?: Array<{ name: string }>;
  webformOptions?: Array<{ value: string; label: string }>;
  onDownload?: (ctx: { action: string; keyword: string; webform: string; url: string; color: string }) => Promise<void>;
}) {
  const keywordRows = keywordOptions?.length ? keywordOptions : keywords;
  const webformRows = webformOptions?.length ? webformOptions : webforms;
  const [action, setAction] = useState('keyword');
  const [keyword, setKeyword] = useState(defaultKeyword ?? 'Jot');
  const [webform, setWebform] = useState('signup');
  const [url, setUrl] = useState('');
  const [color, setColor] = useState('#3e4a57');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<'action' | 'keyword' | 'webform' | null>(null);
  const [kwSearch, setKwSearch] = useState('');

  const filtered = keywordRows.filter((k) => k.name.toLowerCase().includes(kwSearch.toLowerCase()));

  const select = (
    label: string, value: string, opts: { value: string; label: string }[],
    menu: 'action' | 'keyword' | 'webform', onPick: (v: string) => void, searchable = false
  ) => (
    <div className="relative">
      <label className="mb-1.5 block text-[13px] font-semibold text-foreground">{label}</label>
      <button
        className={`tv-select ${openMenu === menu ? 'border-primary ring-2 ring-primary/15' : ''}`}
        onClick={() => setOpenMenu(openMenu === menu ? null : menu)}
      >
        <span className="truncate">{opts.find((o) => o.value === value)?.label ?? value}</span>
        <ChevronDown size={16} className={`shrink-0 text-muted-foreground transition-transform duration-150 ${openMenu === menu ? 'rotate-180' : ''}`} />
      </button>
      {openMenu === menu && (
        <div className="tv-popover absolute z-20 mt-1.5 w-full py-1.5">
          {searchable && (
            <div className="px-2.5 pb-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  className="tv-input py-1.5 pl-8 text-[13px]"
                  placeholder="Search"
                  value={kwSearch}
                  onChange={(e) => setKwSearch(e.target.value)}
                />
              </div>
            </div>
          )}
          <div className="max-h-44 overflow-y-auto">
            {(searchable ? filtered.map((k) => ({ value: k.name, label: k.name })) : opts).map((o) => (
              <button
                key={o.value}
                className={`tv-menu-item justify-between ${o.value === value ? 'bg-accent font-medium text-primary' : ''}`}
                onClick={() => { onPick(o.value); setOpenMenu(null); setKwSearch(''); }}
              >
                <span>{o.label}</span>
                {o.value === value && <Check size={14} className="text-primary" />}
              </button>
            ))}
            {searchable && filtered.length === 0 && (
              <p className="px-3.5 py-2.5 text-[13px] text-muted-foreground">No keywords match your search.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div onClick={() => { if (openMenu) setOpenMenu(null); setPickerOpen(false); }}>
      <nav className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span className="transition-colors hover:text-foreground">Tools</span>
        <span className="text-border">/</span>
        <span className="text-foreground">QR Code Generator</span>
      </nav>
      <div className="mb-1.5 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
          <QrIcon size={18} />
        </span>
        <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground">QR Code Generator</h1>
      </div>
      <p className="mb-7 text-sm text-muted-foreground">Create QR codes for keyword opt-ins and web forms.</p>

      <div className="flex gap-8" onClick={(e) => e.stopPropagation()}>
        <div className="surface w-[400px] shrink-0 space-y-5 self-start rounded-xl bg-card p-6">
          {select('What do you want this QR code to do?', action, qrActions, 'action', setAction)}
          {action === 'keyword' && select('Select a Keyword', keyword, keywordRows.map((k) => ({ value: k.name, label: k.name })), 'keyword', setKeyword, true)}
          {action === 'webform' && select('Select a Web Form', webform, webformRows, 'webform', setWebform)}
          {action === 'url' && (
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-foreground">Destination URL</label>
              <input className="tv-input" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
          )}
          <div className="relative">
            <label className="mb-1.5 block text-[13px] font-semibold text-foreground">QR Code Color</label>
            <div
              className={`tv-input flex cursor-pointer items-center gap-2.5 ${pickerOpen ? 'border-primary ring-2 ring-primary/15' : ''}`}
              onClick={() => setPickerOpen(!pickerOpen)}
            >
              <span className="h-5 w-5 shrink-0 rounded-md ring-1 ring-inset ring-black/15" style={{ background: color }} />
              <input
                className="flex-1 bg-transparent font-mono text-sm text-foreground outline-none"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              <Pipette size={15} className="shrink-0 text-muted-foreground" />
            </div>
            {pickerOpen && (
              <div className="absolute z-20 mt-1.5">
                <ColorPicker value={color} onChange={(c) => { setColor(c); }} />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center pt-1">
          <span className="tv-chip mb-4">QR Code Preview</span>
          <div className="rounded-xl border border-border bg-white p-8 shadow-sm">
            <QrCode color={color} size={280} />
          </div>
          <p className="mt-4 max-w-[280px] text-center text-xs leading-relaxed text-muted-foreground">
            Scan with any phone camera to test. Download a high-resolution PNG for print.
          </p>
        </div>
      </div>

      <div className="mt-10 flex items-center justify-end gap-3 border-t border-border pt-5">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => void onDownload?.({ action, keyword, webform, url, color })}>
          <Download size={15} /> Download
        </Button>
      </div>
    </div>
  );
}
