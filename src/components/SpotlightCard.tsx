import type { ContentIdea } from '@/types/content'
import EmptyState from '@/components/EmptyState'

type Props = { idea: ContentIdea | null }

export default function SpotlightCard({ idea }: Props) {
  if (!idea) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <EmptyState message="Not enough data yet — post something and track it to see your best performer here." icon="🏆" />
      </div>
    )
  }

  return (
    <div className="bg-card border-2 rounded-xl p-5" style={{ borderColor: '#3b82f6' }}>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">🏆 Your best right now</p>
      <p className="text-lg font-bold text-gray-900 mb-3">{idea.title}</p>
      <div className="flex gap-6">
        <div>
          <p className="text-xl font-bold text-gray-900">{(idea.views ?? 0).toLocaleString()}</p>
          <p className="text-xs text-gray-500">Views</p>
        </div>
        <div>
          <p className="text-xl font-bold text-gray-900">{(idea.shares ?? 0).toLocaleString()}</p>
          <p className="text-xs text-gray-500">Shares</p>
        </div>
      </div>
    </div>
  )
}
