import { useIdeas } from '@/hooks/useIdeas'
import { PIPELINE_STAGES, PILLAR_HEX, PIPELINE_STAGE_COLORS, PILLARS } from '@/lib/constants'
import { sumViewsByPillar, getTopPerformer, getTopNByViews, postedDaysSet, metricoolTotals, flattenPerformances } from '@/lib/chartData'
import BarRow from '@/components/BarRow'
import SpotlightCard from '@/components/SpotlightCard'
import EmptyState from '@/components/EmptyState'
import PostingStreakGrid from '@/components/PostingStreakGrid'
import PublishQueueSummary from '@/components/PublishQueueSummary'

export default function Dashboard() {
  const { ideas, loading } = useIdeas()

  const byStage = Object.fromEntries(
    PIPELINE_STAGES.map(s => [s, ideas.filter(i => i.status === s).length])
  )

  const tracked = ideas.filter(i => i.status === 'TRACKED')
  const trackedPerf = flattenPerformances(tracked)
  const totalViews = trackedPerf.reduce((sum, { perf }) => sum + (perf.views ?? 0), 0)
  const totalShares = trackedPerf.reduce((sum, { perf }) => sum + (perf.shares ?? 0), 0)

  const topPerformer = getTopPerformer(ideas)
  const topByViews = getTopNByViews(ideas, 5)
  const maxViews = topByViews[0]?.perf.views ?? 0

  const postedDays = postedDaysSet(ideas)
  const { totalReach, avgEngagementRate } = metricoolTotals(ideas)

  const pillarViews = sumViewsByPillar(ideas)
  const maxPillarViews = Math.max(1, ...pillarViews.map(p => p.views))

  if (loading) return <p className="text-gray-600 text-sm">Loading...</p>

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      <PublishQueueSummary ideas={ideas} />

      {/* Pipeline summary */}
      <section>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Pipeline</p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {PIPELINE_STAGES.map(s => (
            <div
              key={s}
              className="bg-card border-2 rounded-xl p-4 text-center"
              style={{ borderColor: PIPELINE_STAGE_COLORS[s] }}
            >
              <p className="text-3xl font-bold" style={{ color: PIPELINE_STAGE_COLORS[s] }}>{byStage[s] ?? 0}</p>
              <p className="text-xs text-gray-500 mt-1 font-semibold uppercase tracking-wide">{s}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Posting Streak */}
      <section>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Last 30 Days</p>
        <PostingStreakGrid postedDays={postedDays} />
      </section>

      {/* Aggregate stats */}
      <section>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Lifetime (Tracked Posts)</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Posts Tracked', value: tracked.length },
            { label: 'Total Views', value: totalViews.toLocaleString() },
            { label: 'Total Shares', value: totalShares.toLocaleString() },
            { label: 'Ideas in Bank', value: ideas.length },
            { label: 'Total Reach', value: totalReach.toLocaleString() },
            { label: 'Avg Engagement Rate', value: avgEngagementRate !== null ? `${avgEngagementRate.toFixed(1)}%` : '—' },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4">
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Spotlight */}
      <section>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Spotlight</p>
        <SpotlightCard top={topPerformer} />
      </section>

      {/* Vs. Your Best */}
      <section>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Vs. Your Best</p>
        <div className="flex flex-col gap-2">
          {topByViews.length === 0 ? (
            <EmptyState message="Track a few posts to see how they compare to each other." icon="📊" />
          ) : (
            topByViews.map(({ idea, perf }) => (
              <BarRow
                key={`${idea.id}:${perf.platform}`}
                label={`${idea.title} (${perf.platform})`}
                count={perf.views ?? 0}
                max={maxViews}
                color={PILLAR_HEX[idea.pillar]}
              />
            ))
          )}
        </div>
      </section>

      {/* Pillar performance */}
      <section>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">By Pillar (Views)</p>
        <div className="flex flex-col gap-2">
          {tracked.length === 0 ? (
            <EmptyState message="No tracked posts yet — mark a post TRACKED with real views to see pillar performance." icon="📊" />
          ) : (
            pillarViews.map(p => (
              <BarRow
                key={p.pillar}
                label={p.label}
                count={p.views}
                max={maxPillarViews}
                color={PILLAR_HEX[p.pillar]}
                icon={PILLARS.find(pl => pl.value === p.pillar)?.icon}
              />
            ))
          )}
        </div>
      </section>
    </div>
  )
}
