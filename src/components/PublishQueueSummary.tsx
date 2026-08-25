import { Link } from 'react-router-dom'
import { buildPublishQueue } from '@/lib/publishQueue'
import type { ContentIdea } from '@/types/content'

export default function PublishQueueSummary({ ideas, now }: { ideas: ContentIdea[]; now?: Date }) {
  const queue = buildPublishQueue(ideas, now)
  if (!queue.overdue.length && !queue.today.length && !queue.needsTime.length) return null

  const parts = [
    queue.overdue.length > 0 ? `${queue.overdue.length} overdue` : null,
    queue.today.length > 0 ? `${queue.today.length} ready today` : null,
    queue.needsTime.length > 0 ? `${queue.needsTime.length} needs a publish time` : null,
  ].filter(Boolean)

  return (
    <div className="bg-card border-2 border-accent rounded-xl p-4 flex items-center justify-between gap-3">
      <p className="text-sm text-gray-900">{parts.join(' · ')}</p>
      <Link to="/queue" className="text-xs text-accent hover:underline whitespace-nowrap">
        View Queue →
      </Link>
    </div>
  )
}
