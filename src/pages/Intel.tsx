import { useState } from 'react'
import { useIntel } from '@/hooks/useIntel'
import { useIdeas } from '@/hooks/useIdeas'
import { extractTakeaway } from '@/lib/intel'
import { PILLARS } from '@/lib/constants'
import type { Pillar } from '@/types/content'

/* ponytail: line-based markdown render, real md lib if briefs outgrow headings+bullets */
function BriefBody({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-1">
      {text.split('\n').map((line, i) => {
        if (/^#{1,4}\s/.test(line)) {
          return <p key={i} className="text-sm font-bold text-white mt-3">{line.replace(/^#+\s*/, '')}</p>
        }
        if (/^[-•*]\s/.test(line)) {
          return <p key={i} className="text-sm text-gray-400 pl-3">• {line.replace(/^[-•*]\s*/, '')}</p>
        }
        if (!line.trim()) return null
        return <p key={i} className="text-sm text-gray-400 whitespace-pre-wrap">{line}</p>
      })}
    </div>
  )
}

export default function Intel() {
  const { insights, creators, loading, error } = useIntel()
  const { add } = useIdeas()
  const [pillarChoice, setPillarChoice] = useState<Record<string, Pillar>>({})
  const [added, setAdded] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const creatorName = (id: string) => creators.find(c => c.id === id)?.name ?? 'Unknown creator'

  const handleAdd = async (insightId: string, takeaway: string) => {
    const firstLine = takeaway.split('\n')[0].trim()
    await add({
      title: firstLine.length > 120 ? `${firstLine.slice(0, 117)}...` : firstLine,
      body: takeaway,
      pillar: pillarChoice[insightId] ?? 'mindset',
      platform: 'both',
      status: 'IDEA',
      hook: null,
      notes: `From creator intel, week of ${insights.find(i => i.id === insightId)?.week_of ?? '?'}`,
      scheduled_at: null,
      posted_at: null,
      views: null,
      likes: null,
      shares: null,
      saves: null,
      post_url: null,
      idea_score: null,
      idea_score_notes: null,
      execution_score: null,
      execution_score_notes: null,
    })
    setAdded(prev => ({ ...prev, [insightId]: true }))
  }

  if (loading) return <p className="text-gray-600 text-sm">Loading...</p>
  if (error) return <p className="text-red-400 text-sm">Failed to load intel: {error}</p>

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-white">Creator Intel</h1>
      {insights.length === 0 && (
        <p className="text-gray-600 text-sm">
          No briefs yet. The pipeline runs every Monday 6am — briefs land here automatically.
        </p>
      )}
      {insights.map(insight => {
        const takeaway = extractTakeaway(insight.claude_brief)
        const isOpen = expanded[insight.id] ?? false
        return (
          <div key={insight.id} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">{creatorName(insight.creator_id)}</p>
                <p className="text-xs text-gray-500">
                  Week of {insight.week_of}
                  {insight.avg_views ? ` · avg ${Math.round(insight.avg_views).toLocaleString()} views` : ''}
                </p>
              </div>
              <button
                onClick={() => setExpanded(prev => ({ ...prev, [insight.id]: !isOpen }))}
                className="text-xs text-gray-400 hover:text-white"
              >
                {isOpen ? 'Collapse' : 'Full brief'}
              </button>
            </div>

            {takeaway && (
              <div className="bg-surface border border-border rounded-lg p-3 flex flex-col gap-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">This week's play</p>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{takeaway}</p>
                <div className="flex items-center gap-2 mt-1">
                  <select
                    value={pillarChoice[insight.id] ?? 'mindset'}
                    onChange={e => setPillarChoice(prev => ({ ...prev, [insight.id]: e.target.value as Pillar }))}
                    className="bg-card border border-border rounded px-2 py-1 text-xs text-white"
                  >
                    {PILLARS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                  <button
                    onClick={() => void handleAdd(insight.id, takeaway)}
                    disabled={added[insight.id]}
                    className="bg-accent text-white text-xs rounded px-3 py-1 disabled:opacity-50"
                  >
                    {added[insight.id] ? 'Added ✓' : 'Add to Ideas'}
                  </button>
                </div>
              </div>
            )}

            {isOpen && <BriefBody text={insight.claude_brief} />}
          </div>
        )
      })}
    </div>
  )
}
