import type { Pillar, Platform, PipelineStatus } from '@/types/content'

export const PILLARS: { value: Pillar; label: string; color: string }[] = [
  { value: 'training', label: 'Training', color: 'bg-red-900 text-red-200' },
  { value: 'diet', label: 'Diet', color: 'bg-yellow-900 text-yellow-200' },
  { value: 'mindset', label: 'Mindset', color: 'bg-purple-900 text-purple-200' },
  { value: 'life', label: 'Life', color: 'bg-green-900 text-green-200' },
]

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
