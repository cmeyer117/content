import { buildPublishQueue, CONTENT_TIME_ZONE } from './publishQueue'
import type { ContentIdea } from '@/types/content'

export type PlanWeekResult = {
  placed: { id: string; day: string; publishInput: string }[]
  unplaced: string[]
}

const DEFAULT_HOUR = '14:00'

// Batch-schedules a chosen set of READY ideas onto this week's open days --
// one idea per day, remaining today-through-Sunday days that don't already
// have a scheduled post, in the order ideaIds was given. Ideas beyond the
// number of open days come back in `unplaced`, not silently dropped.
export function planWeek(allIdeas: ContentIdea[], ideaIds: string[], now = new Date()): PlanWeekResult {
  const queue = buildPublishQueue(allIdeas, now)
  // Deliberately excludes queue.overdue: a post whose scheduled time already
  // passed today needs its own separate attention (reschedule or mark
  // posted) regardless of this batch action -- it shouldn't block a fresh
  // slot later the same day.
  const occupiedDays = new Set(
    [...queue.today, ...queue.upcoming]
      .map(item => item.publishAt)
      .filter((d): d is Date => d !== null)
      .map(d => new Intl.DateTimeFormat('en-CA', { timeZone: CONTENT_TIME_ZONE }).format(d))
  )
  const openDays = queue.weekKeys.filter(day => day >= queue.todayKey && !occupiedDays.has(day))

  const placed: PlanWeekResult['placed'] = []
  const unplaced: string[] = []
  ideaIds.forEach((id, index) => {
    const day = openDays[index]
    if (!day) { unplaced.push(id); return }
    placed.push({ id, day, publishInput: `${day}T${DEFAULT_HOUR}` })
  })
  return { placed, unplaced }
}
