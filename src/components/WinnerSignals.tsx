import { useState } from 'react'
import { useIdeas } from '@/hooks/useIdeas'
import { detectWinners, SERIES_ANGLES } from '@/lib/winners'
import PillarBadge from '@/components/PillarBadge'
import type { ContentIdeaWithPerformance, NewContentIdea } from '@/types/content'

const dash = (v: string | number | null) => v ?? '—'

export default function WinnerSignals({ ideas }: { ideas: ContentIdeaWithPerformance[] }) {
  const { add, remove } = useIdeas()
  const [creating, setCreating] = useState<string | null>(null)
  const [failedId, setFailedId] = useState<string | null>(null)

  // No local "already created" tracking needed -- add() updates useIdeas'
  // state directly (real-time + optimistic), so once the 3 follow-ups exist
  // their series_source_performance_id naturally excludes this winner from
  // detectWinners on the next render. The card just disappears.
  const winners = detectWinners(ideas, new Date())

  if (winners.length === 0) return null

  const handleCreate = async (winner: (typeof winners)[number]) => {
    setCreating(winner.perf.id)
    setFailedId(null)
    try {
      const results = await Promise.allSettled(SERIES_ANGLES.map((a, i) => {
        const followUp: NewContentIdea = {
          title: `${winner.idea.title} — ${a.label}`,
          body: null,
          pillar: winner.idea.pillar,
          platform: winner.idea.platform,
          status: 'DRAFT',
          hook: winner.idea.hook,
          content_class: winner.idea.content_class,
          hook_first_2s: winner.idea.hook_first_2s,
          viewer_payoff: winner.idea.viewer_payoff,
          target_length_seconds: winner.idea.target_length_seconds,
          length_justification: null,
          diary_justification: null,
          notes: a.prompt,
          source_intel_insight_id: null,
          experiment_id: null,
          scheduled_at: null,
          posted_at: null,
          idea_score: null,
          idea_score_notes: null,
          execution_score: null,
          execution_score_notes: null,
          predicted_score: null,
          predicted_reasoning: null,
          predicted_at: null,
          prediction_version: null,
          series_source_performance_id: winner.perf.id,
          angle: a.angle,
          position: i + 1,
        }
        return add(followUp)
      }))

      const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      if (failures.length > 0) {
        // Roll back whichever ones DID succeed -- leaving 1-2 orphan drafts
        // would also silently make this winner disappear from future
        // detectWinners passes (usedPerformanceIds only needs one match),
        // with no way to retry. This is best-effort, not a hard guarantee:
        // a rollback delete can itself fail (network), and useIdeas.tsx's
        // realtime subscription does full unsequenced reloads on every
        // insert/delete event -- a slow, out-of-order reload could briefly
        // resurrect a just-deleted draft in local state. Both are pre-
        // existing properties of this app's realtime architecture, not
        // something a client-side retry loop can fully close; a genuinely
        // atomic "exactly 3 or none" guarantee would need a server-side
        // RPC, disproportionate for a DRAFT-only feature. Surface the
        // distinction instead of silently claiming success either way.
        const rollback = await Promise.allSettled(
          results
            .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof add>>> => r.status === 'fulfilled')
            .map(r => remove(r.value.id)),
        )
        // If a rollback delete itself fails, that follow-up's
        // series_source_performance_id is now set, which excludes this
        // winner from future detectWinners passes -- this card disappears
        // on the next render regardless of what UI state is set here, so a
        // per-card error message can't reliably reach Carl for this rare
        // double-failure case. console.error is the honest fallback: a
        // real trace to find the orphan by, not a silently swallowed error.
        if (rollback.some(r => r.status === 'rejected')) {
          console.error('Winner→Series rollback partially failed — orphan draft(s) may remain for source performance', winner.perf.id, rollback)
        }
        setFailedId(winner.perf.id)
      }
    } catch {
      setFailedId(winner.perf.id)
    } finally {
      setCreating(null)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Winner Signals</p>
      {winners.map(w => (
        <div key={w.perf.id} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <PillarBadge pillar={w.idea.pillar} />
              <p className="text-sm font-medium text-gray-900">{w.idea.title}</p>
            </div>
            <p className="text-xs text-gray-600 whitespace-nowrap">
              {w.perf.views} views vs {w.baselineMedian} median ({w.multiple.toFixed(1)}x)
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
            <p><span className="text-gray-500 uppercase tracking-wide">Class:</span> {dash(w.idea.content_class)}</p>
            <p><span className="text-gray-500 uppercase tracking-wide">Length:</span> {dash(w.idea.target_length_seconds)}</p>
            <p className="col-span-2"><span className="text-gray-500 uppercase tracking-wide">Hook:</span> {dash(w.idea.hook_first_2s ?? w.idea.hook)}</p>
            <p className="col-span-2"><span className="text-gray-500 uppercase tracking-wide">Payoff:</span> {dash(w.idea.viewer_payoff)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleCreate(w)}
              disabled={creating === w.perf.id}
              className="bg-accent text-white text-xs rounded px-3 py-1 self-start disabled:opacity-40"
            >
              {creating === w.perf.id ? 'Creating...' : 'Create 3 Follow-ups'}
            </button>
            {failedId === w.perf.id && (
              <p className="text-xs text-red-600">Failed to create follow-ups — try again.</p>
            )}
          </div>
        </div>
      ))}
    </section>
  )
}
