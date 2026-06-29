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

  const moveStage = (id: string, status: PipelineStatus) => update(id, { status })

  return { grouped, loading, error, moveStage, remove }
}
