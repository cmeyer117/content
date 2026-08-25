import { useState } from 'react'
import { useIdeas } from '@/hooks/useIdeas'
import { usePipeline } from '@/hooks/usePipeline'
import { buildPublishQueue, CONTENT_TIME_ZONE, type PublishQueueItem } from '@/lib/publishQueue'
import PillarBadge from '@/components/PillarBadge'
import ScheduleIdeaModal from '@/components/ScheduleIdeaModal'
import type { ContentIdea } from '@/types/content'

const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: CONTENT_TIME_ZONE, weekday: 'short', month: 'short', day: 'numeric' })
const timeFormatter = new Intl.DateTimeFormat('en-US', { timeZone: CONTENT_TIME_ZONE, hour: 'numeric', minute: '2-digit' })

function QueueRow({ item, onEdit }: { item: PublishQueueItem; onEdit: (idea: ContentIdea) => void }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 flex items-center justify-between gap-3">
      <div className="min-w-0 flex items-center gap-2">
        <PillarBadge pillar={item.idea.pillar} />
        <p className="text-sm text-gray-900 truncate">{item.idea.title}</p>
        <span className="text-xs text-gray-600 shrink-0">{item.idea.platform}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {item.publishAt && (
          <span className="text-xs text-gray-600">
            {dayFormatter.format(item.publishAt)}, {timeFormatter.format(item.publishAt)}
          </span>
        )}
        <button onClick={() => onEdit(item.idea)} className="text-xs text-accent hover:underline">
          Edit schedule
        </button>
      </div>
    </div>
  )
}

export default function PublishQueue() {
  const { ideas, loading } = useIdeas()
  const { scheduleIdea } = usePipeline()
  const [scheduleTarget, setScheduleTarget] = useState<ContentIdea | null>(null)

  if (loading) return <p className="text-gray-600 text-sm">Loading...</p>

  const queue = buildPublishQueue(ideas)
  const dayKeyOf = (item: PublishQueueItem) =>
    item.publishAt ? new Intl.DateTimeFormat('en-CA', { timeZone: CONTENT_TIME_ZONE }).format(item.publishAt) : null

  const scheduledItems = [...queue.overdue, ...queue.today, ...queue.upcoming]
  const byWeekDay = queue.weekKeys.map(dayKey => ({
    dayKey,
    items: scheduledItems.filter(item => dayKeyOf(item) === dayKey),
  }))
  const laterUpcoming = queue.upcoming.filter(item => !queue.weekKeys.includes(dayKeyOf(item) ?? ''))

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-gray-900">Publish Queue</h1>

      <section className="flex flex-col gap-4">
        {queue.overdue.length > 0 && (
          <div>
            <p className="text-xs font-bold text-red-600 uppercase tracking-widest mb-2">Overdue</p>
            <div className="flex flex-col gap-2">
              {queue.overdue.map(item => <QueueRow key={item.idea.id} item={item} onEdit={setScheduleTarget} />)}
            </div>
          </div>
        )}
        {queue.today.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ready Today</p>
            <div className="flex flex-col gap-2">
              {queue.today.map(item => <QueueRow key={item.idea.id} item={item} onEdit={setScheduleTarget} />)}
            </div>
          </div>
        )}
        {queue.needsTime.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Needs a Publish Time</p>
            <div className="flex flex-col gap-2">
              {queue.needsTime.map(item => <QueueRow key={item.idea.id} item={item} onEdit={setScheduleTarget} />)}
            </div>
          </div>
        )}
        {!queue.overdue.length && !queue.today.length && !queue.needsTime.length && (
          <p className="text-gray-600 text-sm">Nothing needs action right now.</p>
        )}
      </section>

      <section>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">This Week</p>
        <div className="grid grid-cols-7 gap-2">
          {byWeekDay.map(({ dayKey, items }) => (
            <div key={dayKey} className="bg-card border border-border rounded-lg p-2 flex flex-col gap-1 min-h-[80px]">
              <p className="text-xs text-gray-500">{dayFormatter.format(new Date(`${dayKey}T12:00:00Z`))}</p>
              {items.map(item => (
                <p key={item.idea.id} className="text-xs text-gray-900 truncate" title={item.idea.title}>
                  {item.idea.title}
                </p>
              ))}
            </div>
          ))}
        </div>
      </section>

      {laterUpcoming.length > 0 && (
        <section>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Later</p>
          <div className="flex flex-col gap-2">
            {laterUpcoming.map(item => <QueueRow key={item.idea.id} item={item} onEdit={setScheduleTarget} />)}
          </div>
        </section>
      )}

      {scheduleTarget && (
        <ScheduleIdeaModal
          idea={scheduleTarget}
          onClose={() => setScheduleTarget(null)}
          onSchedule={scheduleIdea}
        />
      )}
    </div>
  )
}
