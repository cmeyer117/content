import { useState } from 'react'
import { useIdeas } from '@/hooks/useIdeas'
import { useExperiments } from '@/hooks/useExperiments'
import PillarBadge from '@/components/PillarBadge'
import BarRow from '@/components/BarRow'
import PillarStageBreakdown from '@/components/PillarStageBreakdown'
import ExperimentTable from '@/components/ExperimentTable'
import { countByStage, sumViewsByWeek, countByPillarAndStage } from '@/lib/chartData'
import { experimentRows } from '@/lib/experiments'
import type { ContentIdea, PostPerformance, PostPlatform } from '@/types/content'

type MetricField = 'views' | 'likes' | 'shares' | 'saves'
const METRICS: MetricField[] = ['views', 'likes', 'shares', 'saves']

function formatWeekRange(weeks: { weekStart: string }[]): string {
  if (weeks.length === 0) return ''
  const fmt = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return weeks.length === 1 ? fmt(weeks[0].weekStart) : `${fmt(weeks[0].weekStart)} – ${fmt(weeks[weeks.length - 1].weekStart)}`
}

function ExperimentQueue({ ideas }: { ideas: ContentIdea[] }) {
  const { experiments, active, loading, start, conclude } = useExperiments()
  const [hypothesis, setHypothesis] = useState('')
  const [verdict, setVerdict] = useState('')
  const [starting, setStarting] = useState(false)
  const [concluding, setConcluding] = useState(false)

  if (loading) return null

  const concludedExperiments = experiments.filter(e => e.status === 'concluded')

  const handleStart = async () => {
    if (!hypothesis.trim()) return
    setStarting(true)
    try {
      await start(hypothesis.trim())
      setHypothesis('')
    } finally {
      setStarting(false)
    }
  }

  const handleConclude = async () => {
    if (!active || !verdict.trim()) return
    setConcluding(true)
    try {
      await conclude(active.id, verdict.trim())
      setVerdict('')
    } finally {
      setConcluding(false)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Experiment Queue</p>

      {!active ? (
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
          <input
            className="bg-surface border border-border rounded-lg px-4 py-2 text-gray-900 text-sm w-full"
            placeholder='Hypothesis (e.g. "technique posts outperform diary posts")'
            value={hypothesis}
            onChange={e => setHypothesis(e.target.value)}
          />
          <button
            onClick={() => void handleStart()}
            disabled={starting || !hypothesis.trim()}
            className="bg-accent text-white text-xs rounded px-3 py-1 self-start disabled:opacity-40"
          >
            {starting ? 'Starting...' : 'Start Experiment'}
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
          <p className="text-sm font-medium text-gray-900">{active.hypothesis}</p>
          <ExperimentTable rows={experimentRows(ideas, active.id)} />
          <textarea
            className="bg-surface border border-border rounded-lg px-4 py-2 text-gray-900 text-sm w-full min-h-[80px]"
            placeholder="Verdict — what did this tell you?"
            value={verdict}
            onChange={e => setVerdict(e.target.value)}
          />
          <button
            onClick={() => void handleConclude()}
            disabled={concluding || !verdict.trim()}
            className="bg-accent text-white text-xs rounded px-3 py-1 self-start disabled:opacity-40"
          >
            {concluding ? 'Concluding...' : 'Conclude Experiment'}
          </button>
        </div>
      )}

      {concludedExperiments.length > 0 && (
        <div className="flex flex-col gap-2">
          {concludedExperiments.map(e => (
            <details key={e.id} className="bg-card border border-border rounded-xl p-3">
              <summary className="text-sm font-medium text-gray-900 cursor-pointer">{e.hypothesis}</summary>
              <p className="text-xs text-gray-600 mt-2">{e.verdict}</p>
              <div className="mt-2">
                <ExperimentTable rows={experimentRows(ideas, e.id)} />
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  )
}

export default function Analytics() {
  const { ideas, loading, update, savePerformance } = useIdeas()
  const [editing, setEditing] = useState<Record<string, Partial<PostPerformance>>>({})

  const posted = ideas.filter(i => i.status === 'POSTED' || i.status === 'TRACKED')

  const handleSave = async (ideaId: string, platform: PostPlatform) => {
    const draftKey = `${ideaId}:${platform}`
    const changes = editing[draftKey]
    if (!changes) return
    // Only stamp posted_at on this platform's first-ever save -- an edit to
    // an already-tracked row must never silently move it to a different
    // week in sumViewsByWeek's bucketing.
    const existing = ideas.find(i => i.id === ideaId)?.performances.find(p => p.platform === platform)
    const posted_at = changes.posted_at ?? existing?.posted_at ?? new Date().toISOString()
    await savePerformance(ideaId, platform, { ...changes, posted_at })
    await update(ideaId, { status: 'TRACKED' })
    setEditing(prev => {
      const next = { ...prev }
      delete next[draftKey]
      return next
    })
  }

  const handleCancel = (draftKey: string) => {
    setEditing(prev => {
      const next = { ...prev }
      delete next[draftKey]
      return next
    })
  }

  if (loading) return <p className="text-gray-600 text-sm">Loading...</p>

  const stageData = countByStage(ideas)
  const maxStageCount = Math.max(1, ...stageData.map(s => s.count))
  const weekData = sumViewsByWeek(ideas)
  const maxWeekViews = Math.max(1, ...weekData.map(w => w.views))
  const pillarStageData = countByPillarAndStage(ideas)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>

      <ExperimentQueue ideas={ideas} />

      {/* Pipeline Overview */}
      <section className="flex flex-col gap-6">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Pipeline Stages</p>
          {ideas.length === 0 ? (
            <p className="text-xs text-gray-600">No ideas yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {stageData.map(s => (
                <BarRow key={s.stage} label={s.stage} count={s.count} max={maxStageCount} color="#3b82f6" />
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
            Views by Week{weekData.length > 0 && <span className="normal-case font-normal text-gray-600"> — {formatWeekRange(weekData)}</span>}
          </p>
          {weekData.length === 0 ? (
            <p className="text-xs text-gray-600">No posted content yet.</p>
          ) : (
            <div className="flex flex-col gap-2 mt-2">
              {weekData.map(w => (
                <BarRow key={w.weekStart} label={w.weekStart} count={w.views} max={maxWeekViews} color="#3b82f6" />
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Pillar Breakdown by Stage</p>
          {ideas.length === 0 ? (
            <p className="text-xs text-gray-600">No ideas yet.</p>
          ) : (
            <PillarStageBreakdown data={pillarStageData} />
          )}
        </div>
      </section>

      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Post Performance</p>
      {posted.length === 0 && (
        <p className="text-gray-600 text-sm">No posted content yet. Move ideas to POSTED in the Pipeline.</p>
      )}
      {posted.map(idea => {
        const platforms: PostPlatform[] = idea.platform === 'both' ? ['tiktok', 'instagram'] : [idea.platform]
        return (
          <div key={idea.id} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <PillarBadge pillar={idea.pillar} />
              <p className="text-sm font-medium text-gray-900">{idea.title}</p>
            </div>
            {platforms.map(platform => {
              const existing = idea.performances.find(p => p.platform === platform)
              const draftKey = `${idea.id}:${platform}`
              const draft = editing[draftKey] ?? {}
              const isEditing = !!editing[draftKey]
              return (
                <div key={platform} className="border border-border rounded-lg p-3 flex flex-col gap-3">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{platform}</p>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-500 uppercase tracking-wide">Post URL (auto-syncs stats weekly)</label>
                    <input
                      type="url"
                      placeholder={platform === 'tiktok' ? 'https://www.tiktok.com/@you/video/...' : 'https://www.instagram.com/reel/...'}
                      className="bg-surface border border-border rounded px-2 py-1 text-sm text-gray-900 w-full"
                      value={draft.post_url ?? existing?.post_url ?? ''}
                      onChange={e => setEditing(prev => ({
                        ...prev,
                        [draftKey]: { ...(prev[draftKey] ?? {}), post_url: e.target.value || null },
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
                          className="bg-surface border border-border rounded px-2 py-1 text-sm text-gray-900 w-full"
                          value={(draft as Record<string, number | null | undefined>)[m] ?? (existing?.[m] as number | null) ?? ''}
                          onChange={e => setEditing(prev => ({
                            ...prev,
                            [draftKey]: { ...(prev[draftKey] ?? {}), [m]: Number(e.target.value) },
                          }))}
                        />
                      </div>
                    ))}
                  </div>
                  {isEditing && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => void handleSave(idea.id, platform)}
                        className="bg-accent text-white text-xs rounded px-3 py-1"
                      >
                        Save + Mark Tracked
                      </button>
                      <button
                        onClick={() => handleCancel(draftKey)}
                        className="bg-surface border border-border text-gray-500 text-xs rounded px-3 py-1"
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
      })}
    </div>
  )
}
