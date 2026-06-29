import { usePipeline } from '@/hooks/usePipeline'
import { PIPELINE_STAGES } from '@/lib/constants'
import IdeaCard from '@/components/IdeaCard'

export default function Pipeline() {
  const { grouped, loading, moveStage, remove } = usePipeline()

  if (loading) return <p className="text-gray-600 text-sm">Loading...</p>

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-white">Pipeline</h1>
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
                    onMove={moveStage}
                    onDelete={remove}
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
    </div>
  )
}
