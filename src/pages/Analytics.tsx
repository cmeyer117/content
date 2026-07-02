import { useState } from 'react'
import { useIdeas } from '@/hooks/useIdeas'
import PillarBadge from '@/components/PillarBadge'
import type { ContentIdea } from '@/types/content'

type MetricField = 'views' | 'likes' | 'shares' | 'saves'
const METRICS: MetricField[] = ['views', 'likes', 'shares', 'saves']

export default function Analytics() {
  const { ideas, loading, update } = useIdeas()
  const [editing, setEditing] = useState<Record<string, Partial<ContentIdea>>>({})

  const posted = ideas.filter(i => i.status === 'POSTED' || i.status === 'TRACKED')

  const handleSave = async (id: string) => {
    const changes = editing[id]
    if (!changes) return
    await update(id, { ...changes, status: 'TRACKED' })
    setEditing(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const handleCancel = (id: string) => {
    setEditing(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  if (loading) return <p className="text-gray-600 text-sm">Loading...</p>

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-white">Analytics</h1>
      {posted.length === 0 && (
        <p className="text-gray-600 text-sm">No posted content yet. Move ideas to POSTED in the Pipeline.</p>
      )}
      {posted.map(idea => {
        const draft = editing[idea.id] ?? {}
        const isEditing = !!editing[idea.id]
        return (
          <div key={idea.id} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <PillarBadge pillar={idea.pillar} />
              <p className="text-sm font-medium text-white">{idea.title}</p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 uppercase tracking-wide">Post URL (auto-syncs TikTok stats nightly)</label>
              <input
                type="url"
                placeholder="https://www.tiktok.com/@you/video/..."
                className="bg-surface border border-border rounded px-2 py-1 text-sm text-white w-full"
                value={draft.post_url ?? idea.post_url ?? ''}
                onChange={e => setEditing(prev => ({
                  ...prev,
                  [idea.id]: { ...(prev[idea.id] ?? {}), post_url: e.target.value || null },
                }))}
              />
            </div>
            <div className="grid grid-cols-4 gap-3">
              {METRICS.map(m => (
                <div key={m} className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 uppercase tracking-wide">{m}</label>
                  <input
                    type="number"
                    min={0}
                    className="bg-surface border border-border rounded px-2 py-1 text-sm text-white w-full"
                    value={(draft as Record<string, number | null | undefined>)[m] ?? idea[m as keyof ContentIdea] ?? ''}
                    onChange={e => setEditing(prev => ({
                      ...prev,
                      [idea.id]: { ...(prev[idea.id] ?? {}), [m]: Number(e.target.value) },
                    }))}
                  />
                </div>
              ))}
            </div>
            {isEditing && (
              <div className="flex gap-2">
                <button
                  onClick={() => void handleSave(idea.id)}
                  className="bg-accent text-white text-xs rounded px-3 py-1"
                >
                  Save + Mark Tracked
                </button>
                <button
                  onClick={() => handleCancel(idea.id)}
                  className="bg-surface border border-border text-gray-400 text-xs rounded px-3 py-1"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
