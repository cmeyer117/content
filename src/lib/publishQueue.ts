import type { ContentIdea } from '@/types/content'

export const CONTENT_TIME_ZONE = 'America/New_York'
export type PublishQueueItem = { idea: ContentIdea; publishAt: Date | null }
export type PublishQueue = {
  todayKey: string
  weekKeys: string[]
  overdue: PublishQueueItem[]
  today: PublishQueueItem[]
  upcoming: PublishQueueItem[]
  needsTime: PublishQueueItem[]
}

type DateParts = { year: number; month: number; day: number; hour: number; minute: number }

function easternParts(date: Date): DateParts {
  const values = new Intl.DateTimeFormat('en-US', {
    timeZone: CONTENT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(values.find(part => part.type === type)?.value)
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') }
}

function key(parts: Pick<DateParts, 'year' | 'month' | 'day'>): string {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function mondayKey(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`)
  const mondayOffset = (date.getUTCDay() + 6) % 7
  return addDays(dateKey, -mondayOffset)
}

function parseInput(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const [, year, month, day, hour, minute] = match
  const parts = { year: Number(year), month: Number(month), day: Number(day), hour: Number(hour), minute: Number(minute) }
  if (!Number.isInteger(parts.year) || parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > 31 || parts.hour > 23 || parts.minute > 59) return null
  const calendar = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  return calendar.getUTCFullYear() === parts.year && calendar.getUTCMonth() === parts.month - 1 && calendar.getUTCDate() === parts.day ? parts : null
}

export function publishInputToIso(value: string): string | null {
  const desired = parseInput(value)
  if (!desired) return null
  const desiredUtc = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute)
  let instant = desiredUtc
  for (let attempt = 0; attempt < 3; attempt++) {
    const actual = easternParts(new Date(instant))
    const actualUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute)
    const delta = desiredUtc - actualUtc
    if (delta === 0) return new Date(instant).toISOString()
    instant += delta
  }
  return null
}

export function isoToPublishInput(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = easternParts(date)
  return `${key(parts)}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
}

function validPublishAt(value: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function buildPublishQueue(ideas: ContentIdea[], now = new Date()): PublishQueue {
  const todayKey = key(easternParts(now))
  const monday = mondayKey(todayKey)
  const weekKeys = Array.from({ length: 7 }, (_, index) => addDays(monday, index))
  const queue: PublishQueue = { todayKey, weekKeys, overdue: [], today: [], upcoming: [], needsTime: [] }

  for (const idea of ideas) {
    if (idea.status !== 'SCHEDULED') continue
    const publishAt = validPublishAt(idea.publish_at)
    const item = { idea, publishAt }
    if (!publishAt) { queue.needsTime.push(item); continue }
    const publishKey = key(easternParts(publishAt))
    if (publishAt.getTime() < now.getTime()) queue.overdue.push(item)
    else if (publishKey === todayKey) queue.today.push(item)
    else queue.upcoming.push(item)
  }

  const sortByPublish = (a: PublishQueueItem, b: PublishQueueItem) => (a.publishAt?.getTime() ?? 0) - (b.publishAt?.getTime() ?? 0)
  queue.overdue.sort(sortByPublish)
  queue.today.sort(sortByPublish)
  queue.upcoming.sort(sortByPublish)
  queue.needsTime.sort((a, b) => a.idea.created_at.localeCompare(b.idea.created_at))
  return queue
}
