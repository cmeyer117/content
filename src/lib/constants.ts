import type { Pillar, Platform, PipelineStatus } from '@/types/content'
import trainingIcon from '@/assets/pillars/training.png'
import dietIcon from '@/assets/pillars/diet.png'
import mindsetIcon from '@/assets/pillars/mindset.png'
import lifeIcon from '@/assets/pillars/life.png'
import faithIcon from '@/assets/pillars/faith.png'

export const PILLARS: { value: Pillar; label: string; color: string; icon: string }[] = [
  { value: 'training', label: 'Training', color: 'bg-red-900 text-red-200', icon: trainingIcon },
  { value: 'diet', label: 'Diet', color: 'bg-yellow-900 text-yellow-200', icon: dietIcon },
  { value: 'mindset', label: 'Mindset', color: 'bg-purple-900 text-purple-200', icon: mindsetIcon },
  { value: 'life', label: 'Life', color: 'bg-green-900 text-green-200', icon: lifeIcon },
  { value: 'faith', label: 'Faith', color: 'bg-blue-900 text-blue-200', icon: faithIcon },
]

// Literal hex for pillar colors, matching PILLARS[].color's Tailwind bg-*-900
// classes — needed anywhere a component sets a CSS color value directly
// (e.g. BarRow's backgroundColor) rather than applying a Tailwind class.
export const PILLAR_HEX: Record<Pillar, string> = {
  training: '#7f1d1d',
  diet: '#713f12',
  mindset: '#581c87',
  life: '#14532d',
  faith: '#1e3a8a',
}

export const PIPELINE_STAGES: PipelineStatus[] = [
  'IDEA', 'DRAFT', 'READY', 'SCHEDULED', 'POSTED', 'TRACKED'
]

export const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'both', label: 'Both' },
]

// ponytail: day-of-week defaults from general niche research (Algorithm Playbook,
// Carl Meyer/09 - Content & Marketing). Swap for a real per-account model once
// performance-sync.js has 15-20+ TRACKED posts with actual view data.
export const SUGGESTED_DAYS: Record<Platform, string> = {
  tiktok: 'Sat or Mon',
  instagram: 'Wed or Thu',
  both: 'TikTok: Sat/Mon · IG: Wed/Thu',
}
