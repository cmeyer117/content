import type { Pillar, Platform, PipelineStatus } from '@/types/content'

export const PILLARS: { value: Pillar; label: string; color: string }[] = [
  { value: 'training', label: 'Training', color: 'bg-red-900 text-red-200' },
  { value: 'mindset', label: 'Mindset', color: 'bg-purple-900 text-purple-200' },
  { value: 'faith', label: 'Faith', color: 'bg-yellow-900 text-yellow-200' },
  { value: 'tech', label: 'Tech/AI', color: 'bg-blue-900 text-blue-200' },
  { value: 'life', label: 'Life', color: 'bg-green-900 text-green-200' },
  { value: 'building', label: 'Building', color: 'bg-orange-900 text-orange-200' },
]

export const PIPELINE_STAGES: PipelineStatus[] = [
  'IDEA', 'DRAFT', 'READY', 'SCHEDULED', 'POSTED', 'TRACKED'
]

export const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'both', label: 'Both' },
]
