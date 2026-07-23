import { PILLARS } from '@/lib/constants'
import type { Pillar } from '@/types/content'

export default function PillarBadge({ pillar }: { pillar: Pillar }) {
  const p = PILLARS.find(p => p.value === pillar)
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${p?.color ?? 'bg-gray-800 text-gray-300'}`}>
      {p && <img src={p.icon} alt="" className="w-4 h-4 rounded-full object-cover" />}
      {p?.label ?? pillar}
    </span>
  )
}
