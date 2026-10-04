import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePipeline } from '@/hooks/usePipeline'
import { PIPELINE_STAGES } from '@/lib/constants'
import IdeaCard from '@/components/IdeaCard'
import IdeaDetailModal from '@/components/IdeaDetailModal'
import ScheduleIdeaModal from '@/components/ScheduleIdeaModal'
import { useIdeas } from '@/hooks/useIdeas'
import { useExperiments } from '@/hooks/useExperiments'
import type { ContentIdea } from '@/types/content'

export default function Pipeline() {
  const { grouped, loading, moveStage, scheduleIdea, markPosted, remove } = usePipeline()
  const { update } = useIdeas()
  const { active: activeExperiment } = useExperiments()
  const [selectedIdea, setSelectedIdea] = useState<ContentIdea | null>(null)
  const [scheduleTarget, setScheduleTarget] = useState<ContentIdea | null>(null)
  const [params, setParams] = useSearchParams()
  const wantedId = params.get('idea')

  // Posting-nudge deep link: open the named idea once the board has loaded.
  useEffect(() => {
    if (!wantedId || loading) return
    for (const cards of grouped.values()) {
      const hit = cards.find(i => i.id === wantedId)
      if (hit) { setSelectedIdea(hit); break }
    }
    setParams({}, { replace: true })
  }, [wantedId, loading, grouped, setParams])

  if (loading) return <p className="text-gray-600 text-sm">Loading...</p>

  // The modal gets the LIVE idea (so Mark published refreshes its status, date and counts); the selection is only an id.
  const liveIdea = selectedIdea ? [...grouped.values()].flat().find(i => i.id === selectedIdea.id) : undefined

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map(stage => {
          const cards = grouped.get(stage) ?? []
          return (
            <div key={stage} className="flex-shrink-0 w-64 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{stage}</p>
                <span className="text-xs text-gray-600">{cards.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {cards.map(idea => (
                  <IdeaCard
                    key={idea.id}
                    idea={idea}
                    inquiryCount={idea.inquiry_count}
                    onMove={moveStage}
                    onDelete={remove}
                    onOpen={setSelectedIdea}
                    onScheduleRequest={setScheduleTarget}
                  />
                ))}
                {cards.length === 0 && (
                  <div className="border border-dashed border-border rounded-lg p-4 text-center text-xs text-gray-700">
                    Empty
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {selectedIdea && (
        <IdeaDetailModal
          key={selectedIdea.id}
          idea={liveIdea ?? selectedIdea}
          onClose={() => setSelectedIdea(null)}
          onSave={update}
          onMarkPosted={markPosted}
          activeExperiment={activeExperiment}
        />
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
