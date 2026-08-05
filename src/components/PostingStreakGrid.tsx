type Props = { postedDays: Set<string> }

// Same America/New_York day-key format as chartData.ts's postedDaysSet (YYYY-MM-DD),
// computed independently here since this is a presentational file, not chartData.ts —
// mirrors the "own local copy, not imported cross-repo" precedent in
// api/posting-cadence-logic.js for the same NY-day-boundary concern.
function nyDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(date)
}

export default function PostingStreakGrid({ postedDays }: Props) {
  // Anchor on "today" in NY first, then walk backwards using UTC-day math from
  // that anchor — never the browser's own local calendar day. Doing the
  // subtraction in browser-local time (e.g. `date.setDate(date.getDate() - i)`)
  // can duplicate or skip an NY-calendar day whenever the browser's timezone
  // differs from America/New_York, since local-day and NY-day boundaries fall
  // at different UTC instants. Same noon-UTC-anchor trick chartData.ts's
  // mondayOfWeek/countByWeek already use for this exact class of bug.
  const [y, m, d] = nyDateKey(new Date()).split('-').map(Number)
  const anchor = new Date(Date.UTC(y, m - 1, d, 12))

  const days: { key: string; posted: boolean }[] = []
  for (let i = 29; i >= 0; i--) {
    const cursor = new Date(anchor)
    cursor.setUTCDate(cursor.getUTCDate() - i)
    const key = cursor.toISOString().slice(0, 10)
    days.push({ key, posted: postedDays.has(key) })
  }

  return (
    <div className="flex gap-1 flex-wrap">
      {days.map(d => (
        <div
          key={d.key}
          title={d.key}
          className="w-3 h-3 rounded-sm"
          style={{ backgroundColor: d.posted ? '#16a34a' : '#e5e7eb' }}
        />
      ))}
    </div>
  )
}
