import { useIdeas } from '@/hooks/useIdeas'
import { PIPELINE_STAGES, PILLARS } from '@/lib/constants'

export default function Dashboard() {
  const { ideas, loading } = useIdeas()

  const byStage = Object.fromEntries(
    PIPELINE_STAGES.map(s => [s, ideas.filter(i => i.status === s).length])
  )

  const tracked = ideas.filter(i => i.status === 'TRACKED')
  const totalViews = tracked.reduce((sum, i) => sum + (i.views ?? 0), 0)
  const totalShares = tracked.reduce((sum, i) => sum + (i.shares ?? 0), 0)

  if (loading) return <p className="text-gray-600 text-sm">Loading...</p>

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>

      {/* Pipeline summary */}
      <section>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Pipeline</p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {PIPELINE_STAGES.map(s => (
            <div key={s} className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white">{byStage[s] ?? 0}</p>
              <p className="text-xs text-gray-500 mt-1">{s}</p>
            </div>
          ))}
        </div>
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
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4">
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pillar breakdown */}
      <section>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">By Pillar</p>
        <div className="flex flex-col gap-2">
          {PILLARS.map(p => {
            const count = ideas.filter(i => i.pillar === p.value).length
            const pct = ideas.length ? Math.round((count / ideas.length) * 100) : 0
            return (
              <div key={p.value} className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full w-28 text-center ${p.color}`}>{p.label}</span>
                <div className="flex-1 bg-border rounded-full h-1.5">
                  <div className="bg-accent h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
