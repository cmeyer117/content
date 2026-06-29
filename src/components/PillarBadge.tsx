import { PILLARS } from '@/lib/constants'
import type { Pillar } from '@/types/content'

export default function PillarBadge({ pillar }: { pillar: Pillar }) {
  const p = PILLARS.find(p => p.value === pillar)
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p?.color ?? 'bg-gray-800 text-gray-300'}`}>
      {p?.label ?? pillar}
    </span>
  )
}
