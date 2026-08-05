type Props = { postedDays: Set<string> }

// Same America/New_York day-key format as chartData.ts's postedDaysSet (YYYY-MM-DD),
// computed independently here since this is a presentational file, not chartData.ts —
// mirrors the "own local copy, not imported cross-repo" precedent in
// api/posting-cadence-logic.js for the same NY-day-boundary concern.
function nyDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(date)
}

export default function PostingStreakGrid({ postedDays }: Props) {
  const days: { key: string; posted: boolean }[] = []
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = nyDateKey(d)
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
