/**
 * EFFECTS1c: CapCut-style template catalog: ready-made, editable, multi-layer text / shape groups.
 * Pure data on top of the existing text-item system (TextItem + shapes + stickers + text-anim), so
 * the preview (libass) and export (worker ASS) are the existing paths. Add a template = add an entry.
 * Each part: delayMs = start offset from the playhead, durMs = own length (default = the group's 3 s).
 */
import type { TemplatePart, TextStyle, TitleTemplate } from '@/lib/clips/editor/text-items'
import type { TextAnim } from '@/lib/clips/render-plan/text-anim'

const SHADOW = { color: '#000000', opacity: 75, dist: 4 }
const P: TextStyle = { font: 'Montserrat', size: 96, color: '#FFFFFF', align: 'center', case: 'none', shadow: SHADOW }
const S = (font: TextStyle['font'], size: number, color: string, extra: Partial<TextStyle> = {}): TextStyle => ({
  font, size, color, align: 'center', case: 'upper', ...(extra.box ? {} : { shadow: SHADOW }), ...extra,
})
type Edge = 'fade' | 'pop' | 'zoom' | 'slide_up' | 'slide_down' | 'slide_left' | 'slide_right' | 'bounce_in' | 'zoom_out' | 'rotate_in'
const A = (inT: Edge, outT: Edge = 'fade', inMs = 450, outMs = 350, loop?: 'pulse' | 'bounce' | 'wiggle' | 'flicker'): TextAnim => ({
  in: { type: inT, unit: 'block' as const, durMs: inMs },
  out: { type: outT, unit: 'block' as const, durMs: outMs },
  ...(loop ? { loop: { type: loop, periodMs: 1200 } } : {}),
})
const box = (w: number, h: number, x: number, y: number, color: string, anim: TextAnim = A('pop'), delayMs?: number): TemplatePart => ({
  text: '', kind: 'shape', shape: { type: 'rounded', w, h }, x, y, style: { font: P.font, size: P.size, align: 'center', case: 'none', color }, anim, ...(delayMs ? { delayMs } : {}),
})
const txt = (text: string, x: number, y: number, style: TextStyle, anim: TextAnim = A('fade'), extra: Partial<TemplatePart> = {}): TemplatePart => ({
  text, x, y, style, anim, ...extra,
})
const T = (id: string, label: string, category: string, parts: TemplatePart[]): TitleTemplate => ({ id: `c_${id}`, label, category, parts })

export const TEMPLATE_CATEGORIES = [
  'Titles', 'Lower thirds', 'Intros', 'Outros', 'Call-outs', 'Quotes & stats', 'Social captions', 'Countdown',
] as const

export const CATALOG_TEMPLATES: TitleTemplate[] = [
  // Titles
  T('title_bold', 'Bold title', 'Titles', [txt('BIG TITLE', 50, 40, S('Anton', 150, '#FFFFFF', { stroke: { color: '#000000', width: 10 } }), A('zoom_out', 'fade', 500))]),
  T('title_box', 'Boxed title', 'Titles', [txt('THE TITLE', 50, 40, S('Archivo Black', 96, '#000000', { box: { color: '#FACC15', opacity: 100, pad: 20 } }), A('pop'))]),
  T('title_two_line', 'Title + subtitle', 'Titles', [
    txt('MAIN TITLE', 50, 38, S('Bebas Neue', 150, '#FFFFFF', { shadow: { color: '#000000', opacity: 70, dist: 5 } }), A('slide_up')),
    txt('a short subtitle', 50, 47, { ...P, font: 'Poppins', size: 60 }, A('fade', 'fade', 500), { delayMs: 300 }),
  ]),
  T('title_gradient', 'Gradient title', 'Titles', [txt('LEVEL UP', 50, 40, S('Luckiest Guy', 140, '#FFFFFF', { stroke: { color: '#0F172A', width: 8 }, gradient: { from: '#F472B6', to: '#8B5CF6', dir: 'v' } }), A('rotate_in', 'zoom', 500))]),
  T('title_card', 'Title card', 'Titles', [
    box(1100, 420, 50, 45, '#0F172A', A('zoom_out')),
    txt('CHAPTER ONE', 50, 43, S('Anton', 120, '#FFFFFF'), A('fade'), { delayMs: 200 }),
    txt('the beginning', 50, 50, { ...P, font: 'Poppins', size: 56, color: '#94A3B8' }, A('fade'), { delayMs: 400 }),
  ]),
  // Lower thirds
  T('lt_dark', 'Name · dark bar', 'Lower thirds', [
    box(700, 170, 38, 80, '#1D4ED8', A('slide_right', 'slide_left')),
    txt('Your Name\n<i>Role · Company</i>', 38, 80, { ...P, font: 'Poppins', size: 54, lineHeight: 1.1 }, A('slide_right', 'slide_left'), { delayMs: 150 }),
  ]),
  T('lt_accent', 'Name · accent', 'Lower thirds', [
    box(60, 170, 12, 80, '#E11D48', A('slide_up', 'fade')),
    txt('YOUR NAME', 40, 78, S('Archivo Black', 64, '#FFFFFF', { align: 'left', shadow: { color: '#000000', opacity: 80, dist: 4 } }), A('slide_right', 'slide_left'), { delayMs: 100 }),
    txt('Role · Company', 40, 83, { ...P, font: 'Poppins', size: 46, align: 'left' }, A('fade'), { delayMs: 300 }),
  ]),
  T('lt_light', 'Name · light', 'Lower thirds', [
    box(720, 170, 50, 82, '#FFFFFF', A('pop')),
    txt('Your Name\n<i>Role</i>', 50, 82, { ...P, font: 'Poppins', size: 54, color: '#111111', lineHeight: 1.1 }, A('fade'), { delayMs: 150 }),
  ]),
  T('lt_pill', 'Name · pill', 'Lower thirds', [txt('@yourhandle', 50, 85, { ...P, font: 'Poppins', size: 56, box: { color: '#7C3AED', opacity: 100, pad: 16 } }, A('bounce_in'))]),
  // Intros
  T('intro_welcome', 'Welcome', 'Intros', [txt('WELCOME BACK', 50, 45, S('Bebas Neue', 160, '#FFFFFF', { letterSpacing: 8 }), A('zoom_out', 'fade', 700, 400))]),
  T('intro_today', "Today's topic", 'Intros', [
    txt("TODAY WE'RE TALKING", 50, 40, S('Poppins', 60, '#FACC15'), A('slide_down')),
    txt('THE TOPIC', 50, 47, S('Anton', 140, '#FFFFFF', { stroke: { color: '#000000', width: 8 } }), A('pop'), { delayMs: 400 }),
  ]),
  T('intro_episode', 'Episode', 'Intros', [
    box(560, 150, 50, 40, '#DC2626', A('rotate_in')),
    txt('EPISODE 1', 50, 40, S('Archivo Black', 72, '#FFFFFF'), A('fade'), { delayMs: 250 }),
  ]),
  T('intro_typewriter', 'Typewriter intro', 'Intros', [txt('Let me tell you something…', 50, 45, { ...P, font: 'Poppins', size: 76, box: { color: '#000000', opacity: 75, pad: 16 } }, { in: { type: 'typewriter', unit: 'char', durMs: 1400 }, out: { type: 'fade', unit: 'block', durMs: 300 } })]),
  // Outros
  T('outro_thanks', 'Thanks for watching', 'Outros', [txt('THANKS FOR WATCHING', 50, 42, S('Anton', 120, '#FFFFFF', { stroke: { color: '#000000', width: 8 } }), A('zoom_out', 'fade', 600))]),
  T('outro_end_card', 'End card', 'Outros', [
    box(1100, 640, 50, 45, '#0F172A', A('fade')),
    txt('WATCH NEXT', 50, 33, S('Bebas Neue', 120, '#FACC15'), A('slide_down'), { delayMs: 200 }),
    box(900, 300, 50, 50, '#334155', A('pop'), 400),
  ]),
  T('outro_see_you', 'See you next time', 'Outros', [txt('See you next time', 50, 45, { ...P, font: 'Poppins', size: 84 }, A('bounce_in', 'fade', 600))]),
  T('outro_follow', 'Follow for more', 'Outros', [
    txt('FOLLOW FOR MORE', 50, 45, S('Archivo Black', 88, '#FFFFFF', { box: { color: '#E11D48', opacity: 100, pad: 18 } }), A('pop', 'zoom', 400, 300, 'pulse')),
  ]),
  // Call-outs
  T('co_subscribe', 'Subscribe button', 'Call-outs', [
    box(560, 150, 50, 72, '#DC2626', A('pop', 'zoom')),
    txt('SUBSCRIBE', 50, 72, S('Archivo Black', 72, '#FFFFFF', { letterSpacing: 4 }), A('pop', 'zoom')),
    { text: '', kind: 'sticker', sticker: 'pointer', x: 70, y: 78, delayMs: 400, style: { ...P, size: 180 }, anim: A('slide_up', 'fade', 400, 300, 'bounce') },
  ]),
  T('co_like', 'Like & share', 'Call-outs', [txt('LIKE  ·  SHARE', 50, 75, S('Archivo Black', 70, '#FFFFFF', { box: { color: '#2563EB', opacity: 100, pad: 16 } }), A('bounce_in', 'fade', 500, 300, 'pulse'))]),
  T('co_follow_handle', 'Follow @handle', 'Call-outs', [
    txt('FOLLOW', 50, 70, S('Bebas Neue', 110, '#FACC15'), A('slide_up')),
    txt('@yourhandle', 50, 76, { ...P, font: 'Poppins', size: 64 }, A('fade'), { delayMs: 250 }),
  ]),
  T('co_link_bio', 'Link in bio', 'Call-outs', [txt('LINK IN BIO', 50, 80, S('Archivo Black', 70, '#000000', { box: { color: '#FFFFFF', opacity: 100, pad: 16 } }), A('pop', 'fade', 400, 300, 'bounce'))]),
  T('co_comment', 'Comment below', 'Call-outs', [txt('COMMENT BELOW', 50, 78, S('Luckiest Guy', 90, '#22D3EE', { stroke: { color: '#0F172A', width: 8 } }), A('rotate_in', 'fade'))]),
  // Quotes & stats
  T('qs_quote', 'Quote', 'Quotes & stats', [
    txt('"', 50, 32, S('Anton', 220, '#FACC15'), A('pop')),
    txt('Your quote goes here,\nshort and punchy.', 50, 42, { ...P, font: 'Poppins', size: 72, lineHeight: 1.15 }, A('fade', 'fade', 600), { delayMs: 200 }),
    txt('— Name', 50, 52, { ...P, font: 'Poppins', size: 48, color: '#94A3B8' }, A('fade'), { delayMs: 500 }),
  ]),
  T('qs_stat', 'Big stat', 'Quotes & stats', [
    txt('87%', 50, 40, S('Anton', 240, '#22C55E', { stroke: { color: '#000000', width: 10 } }), A('zoom_out', 'fade', 500)),
    txt('of people agree', 50, 50, { ...P, font: 'Poppins', size: 64 }, A('slide_up'), { delayMs: 300 }),
  ]),
  T('qs_fact', 'Fact box', 'Quotes & stats', [
    box(1000, 360, 50, 45, '#FFFFFF', A('pop')),
    txt('DID YOU KNOW?', 50, 40, S('Archivo Black', 64, '#E11D48'), A('fade'), { delayMs: 150 }),
    txt('Your fact goes here.', 50, 47, { ...P, font: 'Poppins', size: 60, color: '#111111' }, A('fade'), { delayMs: 300 }),
  ]),
  T('qs_versus', 'Before / after', 'Quotes & stats', [
    txt('BEFORE', 28, 20, S('Archivo Black', 72, '#FFFFFF', { box: { color: '#64748B', opacity: 100, pad: 14 } }), A('slide_right', 'slide_left')),
    txt('AFTER', 72, 20, S('Archivo Black', 72, '#FFFFFF', { box: { color: '#16A34A', opacity: 100, pad: 14 } }), A('slide_left', 'slide_right'), { delayMs: 200 }),
  ]),
  // Social captions (bold word-pop)
  T('sc_word_pop', 'Word pop', 'Social captions', [txt('THIS IS HOW', 50, 70, S('Montserrat', 110, '#FFFFFF', { stroke: { color: '#000000', width: 10 } }), { in: { type: 'pop', unit: 'word', durMs: 900 }, out: { type: 'fade', unit: 'block', durMs: 300 } })]),
  T('sc_yellow_punch', 'Yellow punch', 'Social captions', [txt('NO WAY', 50, 70, S('Montserrat', 130, '#FACC15', { stroke: { color: '#000000', width: 10 } }), A('bounce_in', 'fade', 400, 300, 'pulse'))]),
  T('sc_boxed_words', 'Boxed words', 'Social captions', [txt('WATCH THIS', 50, 70, S('Montserrat', 104, '#FFFFFF', { box: { color: '#E11D48', opacity: 100, pad: 14 } }), { in: { type: 'pop', unit: 'word', durMs: 800 }, out: { type: 'fade', unit: 'word', durMs: 400 } })]),
  T('sc_comic', 'Comic hype', 'Social captions', [txt('LET’S GO!', 50, 70, S('Bangers', 140, '#FFFFFF', { stroke: { color: '#000000', width: 10 }, shadow: { color: '#000000', opacity: 100, dist: 6 } }), A('rotate_in', 'zoom', 400, 300, 'wiggle'))]),
  // Countdown
  T('cd_321', '3 · 2 · 1', 'Countdown', ['3', '2', '1'].map((n, i) =>
    txt(n, 50, 45, S('Anton', 300, '#FFFFFF', { stroke: { color: '#000000', width: 12 } }), A('zoom_out', 'fade', 300, 200), { delayMs: i * 1000, durMs: 1000 }))),
  T('cd_321_go', '3 · 2 · 1 · GO', 'Countdown', [
    ...['3', '2', '1'].map((n, i) => txt(n, 50, 45, S('Bebas Neue', 320, '#FACC15'), A('pop', 'fade', 250, 200), { delayMs: i * 700, durMs: 700 })),
    txt('GO!', 50, 45, S('Luckiest Guy', 260, '#22C55E', { stroke: { color: '#000000', width: 10 } }), A('zoom_out', 'fade', 300, 300), { delayMs: 2100, durMs: 900 }),
  ]),
  T('cd_circle', 'Countdown circle', 'Countdown', [
    { text: '', kind: 'shape', shape: { type: 'rounded', w: 420, h: 420 }, x: 50, y: 45, style: { font: P.font, size: P.size, align: 'center', case: 'none', color: '#E11D48' }, anim: A('pop', 'fade', 300, 300, 'pulse') },
    ...['3', '2', '1'].map((n, i) => txt(n, 50, 45, S('Anton', 220, '#FFFFFF'), A('zoom_out', 'fade', 250, 150), { delayMs: i * 1000, durMs: 1000 })),
  ]),
  T('cd_starting', 'Starting in…', 'Countdown', [
    txt('STARTING IN', 50, 36, S('Bebas Neue', 100, '#FFFFFF'), A('fade')),
    ...['3', '2', '1'].map((n, i) => txt(n, 50, 46, S('Anton', 240, '#FACC15'), A('pop', 'fade', 250, 200), { delayMs: i * 1000, durMs: 1000 })),
  ]),
]
