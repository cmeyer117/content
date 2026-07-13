import type { ContentIdea, PipelineStatus } from '@/types/content'
import PillarBadge from './PillarBadge'
import StatusBadge from './StatusBadge'
import { PIPELINE_STAGES, SUGGESTED_DAYS } from '@/lib/constants'

type Props = {
  idea: ContentIdea
  onMove: (id: string, status: PipelineStatus) => void
  onDelete: (id: string) => void
  onOpen: (idea: ContentIdea) => void
}

export default function IdeaCard({ idea, onMove, onDelete, onOpen }: Props) {
  const currentIdx = PIPELINE_STAGES.indexOf(idea.status)
  const nextStage = PIPELINE_STAGES[currentIdx + 1] ?? null

  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2">
      <div
        className="flex items-start justify-between gap-2 cursor-pointer"
        onClick={() => onOpen(idea)}
      >
        <p className="text-sm font-medium text-white leading-snug">{idea.title}</p>
        <button
          onClick={e => { e.stopPropagation(); onDelete(idea.id) }}
          className="text-gray-600 hover:text-red-400 text-xs shrink-0"
        >
          ✕
        </button>
      </div>
      {idea.hook && (
        <p className="text-xs text-gray-500 italic">"{idea.hook}"</p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <PillarBadge pillar={idea.pillar} />
        <StatusBadge status={idea.status} />
        <span className="text-xs text-gray-600">{idea.platform}</span>
      </div>
      {nextStage && (
        <button
          onClick={e => { e.stopPropagation(); onMove(idea.id, nextStage) }}
          className="mt-1 text-xs text-accent hover:underline text-left"
        >
          Move → {nextStage}
        </button>
      )}
      {nextStage === 'SCHEDULED' && (
        <p className="text-xs text-gray-600">Suggested: {SUGGESTED_DAYS[idea.platform]}</p>
      )}
    </div>
  )
}
