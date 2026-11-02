import type { BrandKitColumns } from './brand-kit'

export type BrandStarter = { id: string; name: string; settings: Record<string, unknown>; columns: BrandKitColumns }

const cap = (presetId: string, position = 'bottom') => ({ captionPreset: { presetId, position } })

export const BRAND_STARTERS: BrandStarter[] = [
  {
    id: 'podcast_clean',
    name: 'Podcast clean',
    settings: {
      primaryColor: '#F8FAFC',
      logoPosition: 'TL',
      ...cap('clean_white'),
      defaultLayoutMode: 'split',
      defaultMusicMood: 'upbeat lo-fi instrumental',
    },
    columns: {
      headingFont: 'Inter',
      captionFont: 'Inter',
      palette: ['#0F172A', '#F8FAFC', '#38BDF8'],
      aspectOverrides: { '16:9': { logoPosition: 'TR' } },
    },
  },
  {
    id: 'gaming_neon',
    name: 'Gaming neon',
    settings: {
      primaryColor: '#22D3EE',
      logoPosition: 'TR',
      ...cap('cp13'),
      defaultLayoutMode: 'facecam_stack',
      defaultMusicMood: 'upbeat lo-fi instrumental',
    },
    columns: { headingFont: 'Bangers', captionFont: 'Montserrat', palette: ['#0B0F1A', '#22D3EE', '#FF2BD6', '#A3E635'] },
  },
  {
    id: 'business_minimal',
    name: 'Business minimal',
    settings: {
      primaryColor: '#2563EB',
      logoPosition: 'BR',
      ...cap('lower_third'),
      defaultLayoutMode: 'speaker_follow',
      defaultMusicMood: 'upbeat lo-fi instrumental',
    },
    columns: { headingFont: 'Inter', captionFont: 'Inter', palette: ['#111827', '#FFFFFF', '#2563EB'] },
  },
  {
    id: 'bold_creator',
    name: 'Bold creator',
    settings: {
      primaryColor: '#FACC15',
      logoPosition: 'TR',
      ...cap('word_pop', 'middle'),
      defaultLayoutMode: 'speaker_follow',
      defaultMusicMood: 'upbeat lo-fi instrumental',
    },
    columns: { headingFont: 'Archivo Black', captionFont: 'Poppins', palette: ['#000000', '#FFFFFF', '#FACC15'] },
  },
  {
    id: 'news',
    name: 'News',
    settings: {
      primaryColor: '#DC2626',
      logoPosition: 'TL',
      ...cap('lower_third'),
      defaultLayoutMode: 'fit_top',
      defaultMusicMood: 'upbeat lo-fi instrumental',
    },
    columns: {
      headingFont: 'Oswald',
      captionFont: 'Roboto',
      palette: ['#DC2626', '#FFFFFF', '#111827'],
      watermarkPosition: 'BR',
      watermarkOpacity: 0.6,
    },
  },
  {
    id: 'educational',
    name: 'Educational',
    settings: {
      primaryColor: '#10B981',
      logoPosition: 'BL',
      ...cap('cp16'),
      defaultLayoutMode: 'screen_pip',
      defaultMusicMood: 'upbeat lo-fi instrumental',
    },
    columns: { headingFont: 'Lato', captionFont: 'Inter', palette: ['#064E3B', '#ECFDF5', '#10B981', '#F59E0B'] },
  },
  {
    id: 'hype',
    name: 'Hype',
    settings: {
      primaryColor: '#E11D48',
      logoPosition: 'TR',
      ...cap('cp17'),
      defaultLayoutMode: 'dynamic',
      defaultMusicMood: 'upbeat lo-fi instrumental',
    },
    columns: { headingFont: 'Bebas Neue', captionFont: 'Bebas Neue', palette: ['#000000', '#E11D48', '#FFD93D'] },
  },
  {
    id: 'soft_pastel',
    name: 'Soft pastel',
    settings: {
      primaryColor: '#F9A8D4',
      logoPosition: 'TL',
      ...cap('cp18'),
      defaultLayoutMode: 'fit_blur',
      defaultMusicMood: 'upbeat lo-fi instrumental',
    },
    columns: {
      headingFont: 'Playfair Display',
      captionFont: 'Lato',
      palette: ['#FDF2F8', '#F9A8D4', '#C4B5FD', '#A7F3D0', '#1F2937'],
    },
  },
]
