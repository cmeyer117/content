import type { ContentIdea, PipelineStatus } from '@/types/content'
import PillarBadge from './PillarBadge'
import StatusBadge from './StatusBadge'
import { PIPELINE_STAGES, SUGGESTED_DAYS } from '@/lib/constants'
import { isReadyForDraft } from '@/lib/hookGate'

type Props = {
  idea: ContentIdea
  onMove: (id: string, status: PipelineStatus) => void
  onDelete: (id: string) => void
  onOpen: (idea: ContentIdea) => void
}

export default function IdeaCard({ idea, onMove, onDelete, onOpen }: Props) {
  const currentIdx = PIPELINE_STAGES.indexOf(idea.status)
  const nextStage = PIPELINE_STAGES[currentIdx + 1] ?? null
  // Gate the transition into READY, not IDEA -> DRAFT -- a draft may still
  // evolve, but a READY post shouldn't exist without hook-quality fields set.
  // Fixed 2026-08-19: was gating the wrong transition (see hookGate.ts and
  // IdeaDetailModal.tsx's matching fix).
  const gate = nextStage === 'READY' ? isReadyForDraft(idea) : { ready: true, missing: [] }

  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2">
      <div
        className="flex items-start justify-between gap-2 cursor-pointer"
        onClick={() => onOpen(idea)}
      >
        <p className="text-sm font-medium text-gray-900 leading-snug">{idea.title}</p>
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
        {idea.idea_score != null && (
          <span className="text-xs text-gray-600">🎯 {idea.idea_score}</span>
        )}
        {idea.execution_score != null && (
          <span className="text-xs text-gray-600">🎬 {idea.execution_score}</span>
        )}
        {idea.predicted_score != null && (
          <span className="text-xs text-gray-600" title={idea.predicted_reasoning ?? undefined}>🔮 {idea.predicted_score}</span>
        )}
        {idea.source_intel_insight_id && (
          <span className="text-xs text-gray-600" title="Originated from a creator intel insight">🧠 from intel</span>
        )}
      </div>
      {nextStage && (
        <button
          onClick={e => { e.stopPropagation(); onMove(idea.id, nextStage) }}
          disabled={!gate.ready}
          title={gate.ready ? undefined : `Missing: ${gate.missing.join(', ')}`}
          className="mt-1 text-xs text-accent hover:underline text-left disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
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
