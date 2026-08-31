'use client';
import { useState } from 'react';
import { QrCode as QrIcon, ChevronDown, Check, Download, Pipette, Search } from 'lucide-react';
import { keywords, qrActions, webforms } from '../mock-data';
import QrCode from './QrCode';
import ColorPicker from './ColorPicker';

export default function QrGenerator({ onCancel, defaultKeyword }: { onCancel: () => void; defaultKeyword?: string }) {
  const [action, setAction] = useState('keyword');
  const [keyword, setKeyword] = useState(defaultKeyword ?? 'Jot');
  const [webform, setWebform] = useState('signup');
  const [url, setUrl] = useState('');
  const [color, setColor] = useState('#3e4a57');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<'action' | 'keyword' | 'webform' | null>(null);
  const [kwSearch, setKwSearch] = useState('');

  const filtered = keywords.filter((k) => k.name.toLowerCase().includes(kwSearch.toLowerCase()));

  const select = (
    label: string, value: string, opts: { value: string; label: string }[],
    menu: 'action' | 'keyword' | 'webform', onPick: (v: string) => void, searchable = false
  ) => (
    <div className="relative">
      <label className="block text-[13px] font-semibold text-foreground mb-1.5">{label}</label>
      <button
        className={`tv-select ${openMenu === menu ? 'border-primary ring-2 ring-primary/15' : ''}`}
        onClick={() => setOpenMenu(openMenu === menu ? null : menu)}
      >
        <span className="truncate">{opts.find((o) => o.value === value)?.label ?? value}</span>
        <ChevronDown size={16} className={`text-muted-foreground transition-transform ${openMenu === menu ? 'rotate-180' : ''}`} />
      </button>
      {openMenu === menu && (
        <div className="tv-popover absolute z-20 mt-1.5 w-full py-1.5">
          {searchable && (
            <div className="px-2.5 pb-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  className="tv-input pl-8 py-1.5 text-[13px]"
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
                className={`tv-menu-item justify-between ${o.value === value ? 'bg-accent text-primary font-medium' : ''}`}
                onClick={() => { onPick(o.value); setOpenMenu(null); setKwSearch(''); }}
              >
                <span>{o.label}</span>
                {o.value === value && <Check size={14} className="text-primary" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div onClick={() => { if (openMenu) setOpenMenu(null); }}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
        <span>Tools</span><span className="text-border">/</span><span>QR Code Generator</span>
      </div>
      <div className="flex items-center gap-2.5 mb-1.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
          <QrIcon size={18} />
        </span>
        <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground">QR Code Generator</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-7">Create QR codes for keyword opt-ins and web forms.</p>

      <div className="flex gap-10" onClick={(e) => e.stopPropagation()}>
        <div className="w-[400px] shrink-0 space-y-5">
          {select('What do you want this QR code to do?', action, qrActions, 'action', setAction)}
          {action === 'keyword' && select('Select a Keyword', keyword, keywords.map((k) => ({ value: k.name, label: k.name })), 'keyword', setKeyword, true)}
          {action === 'webform' && select('Select a Web Form', webform, webforms, 'webform', setWebform)}
          {action === 'url' && (
            <div>
              <label className="block text-[13px] font-semibold text-foreground mb-1.5">Destination URL</label>
              <input className="tv-input" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
          )}
          <div className="relative">
            <label className="block text-[13px] font-semibold text-foreground mb-1.5">QR Code Color</label>
            <div className="tv-input flex items-center gap-2.5 cursor-pointer" onClick={() => setPickerOpen(!pickerOpen)}>
              <span className="w-5 h-5 rounded-md ring-1 ring-inset ring-black/15 shrink-0" style={{ background: color }} />
              <input
                className="flex-1 bg-transparent outline-none text-sm text-foreground font-mono"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              <Pipette size={15} className="text-muted-foreground shrink-0" />
            </div>
            {pickerOpen && (
              <div className="absolute z-20 mt-1.5">
                <ColorPicker value={color} onChange={(c) => { setColor(c); }} />
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center pt-1">
          <span className="tv-chip mb-4">QR Code Preview</span>
          <div className="bg-white border border-border rounded-xl shadow-sm p-8">
            <QrCode color={color} size={280} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 mt-10 pt-5 border-t border-border">
        <button className="tv-btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="tv-btn-primary flex items-center gap-2"><Download size={15} />Download</button>
      </div>
    </div>
  );
}
