import { generateNextPostBrief } from '@/lib/nextPostBrief'
import type { ContentIdeaWithPerformance } from '@/types/content'

export default function NextPostBrief({ ideas }: { ideas: ContentIdeaWithPerformance[] }) {
  const brief = generateNextPostBrief(ideas)
  if (!brief) return null

  return (
    <section className="bg-card border border-border rounded-xl p-5 flex flex-col gap-1">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Next Post Brief</p>
      <p className="text-sm text-gray-900">{brief.summary}</p>
    </section>
  )
}
