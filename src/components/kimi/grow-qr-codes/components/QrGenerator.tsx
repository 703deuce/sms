'use client';
import { useState } from 'react';
import { QrCode as QrIcon, ChevronDown, Download, Pipette } from 'lucide-react';
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
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      <button className="tv-select" onClick={() => setOpenMenu(openMenu === menu ? null : menu)}>
        <span>{opts.find((o) => o.value === value)?.label ?? value}</span>
        <ChevronDown size={16} className="text-muted-foreground" />
      </button>
      {openMenu === menu && (
        <div className="tv-popover absolute z-20 mt-1 w-full py-1">
          {searchable && (
            <div className="px-2 pb-1.5">
              <input autoFocus className="tv-input" placeholder="Search" value={kwSearch} onChange={(e) => setKwSearch(e.target.value)} />
            </div>
          )}
          <div className="max-h-44 overflow-y-auto">
            {(searchable ? filtered.map((k) => ({ value: k.name, label: k.name })) : opts).map((o) => (
              <button
                key={o.value}
                className={`tv-menu-item ${o.value === value ? 'bg-accent text-primary font-medium' : ''}`}
                onClick={() => { onPick(o.value); setOpenMenu(null); setKwSearch(''); }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div onClick={() => { if (openMenu) setOpenMenu(null); }}>
      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
        <span>Tools</span><span>/</span><span>QR Code Generator</span>
      </div>
      <div className="flex items-center gap-2.5 mb-1">
        <QrIcon size={22} className="text-foreground" />
        <h1 className="text-xl font-semibold text-foreground">QR Code Generator</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">Create QR codes for keyword opt-ins and web forms.</p>

      <div className="flex gap-8" onClick={(e) => e.stopPropagation()}>
        <div className="w-[420px] shrink-0 space-y-5">
          {select('What do you want this QR code to do?', action, qrActions, 'action', setAction)}
          {action === 'keyword' && select('Select a Keyword', keyword, keywords.map((k) => ({ value: k.name, label: k.name })), 'keyword', setKeyword, true)}
          {action === 'webform' && select('Select a Web Form', webform, webforms, 'webform', setWebform)}
          {action === 'url' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Destination URL</label>
              <input className="tv-input" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
          )}
          <div className="relative">
            <label className="block text-sm font-medium text-foreground mb-1.5">QR Code Color</label>
            <div className="tv-input flex items-center gap-2 cursor-pointer" onClick={() => setPickerOpen(!pickerOpen)}>
              <span className="w-5 h-5 rounded border border-border" style={{ background: color }} />
              <input
                className="flex-1 bg-transparent outline-none text-sm text-foreground"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              <Pipette size={15} className="text-muted-foreground" />
            </div>
            {pickerOpen && (
              <div className="absolute z-20 mt-1">
                <ColorPicker value={color} onChange={(c) => { setColor(c); }} />
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center pt-2">
          <span className="tv-chip mb-4">QR Code Preview</span>
          <div className="bg-white border border-border rounded-lg shadow-sm p-6">
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
