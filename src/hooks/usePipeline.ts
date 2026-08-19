import { useMemo } from 'react'
import { useIdeas } from './useIdeas'
import { PIPELINE_STAGES } from '@/lib/constants'
import type { PipelineStatus, ContentIdea } from '@/types/content'

export function usePipeline() {
  const { ideas, loading, error, update, remove } = useIdeas()

  const grouped = useMemo(() => {
    const map = new Map<PipelineStatus, ContentIdea[]>()
    for (const stage of PIPELINE_STAGES) map.set(stage, [])
    for (const idea of ideas) {
      map.get(idea.status)?.push(idea)
    }
    return map
  }, [ideas])

  // Fixed 2026-08-19: moving to SCHEDULED/POSTED never set scheduled_at/
  // posted_at, silently breaking everything downstream that reads them --
  // the weekly view chart and posting streak (chartData.ts), and the
  // cadence-nudge query (api/send-posting-cadence-nudge.js), which only
  // matches rows where posted_at is non-null. Found via a Codex code review.
  // Only sets the timestamp the first time a card reaches that stage --
  // moving it there again (e.g. after a status correction) won't overwrite
  // an already-recorded real post/schedule time.
  const moveStage = (id: string, status: PipelineStatus) => {
    const idea = ideas.find(i => i.id === id)
    const patch: Partial<ContentIdea> = { status }
    if (status === 'SCHEDULED' && idea && !idea.scheduled_at) {
      patch.scheduled_at = new Date().toISOString()
    }
    if (status === 'POSTED' && idea && !idea.posted_at) {
      patch.posted_at = new Date().toISOString()
    }
    return update(id, patch)
  }

  return { grouped, loading, error, moveStage, remove }
}
