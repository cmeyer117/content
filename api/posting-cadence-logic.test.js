import { describe, it, expect } from 'vitest'
import { todayEasternKey, hasPostedToday } from './posting-cadence-logic.js'

describe('todayEasternKey', () => {
  it('matches the calendar date for a mid-evening Eastern timestamp', () => {
    // 2026-07-21T23:30:00Z is 7:30pm Eastern (EDT, UTC-4) — same calendar day as UTC here.
    expect(todayEasternKey(new Date('2026-07-21T23:30:00Z'))).toBe('2026-07-21')
  })

  it('UTC/Eastern day boundary — 3:59am UTC is still previous day Eastern', () => {
    // 2026-07-22T03:59:00Z is 2026-07-21 11:59pm Eastern (EDT, UTC-4) — one minute before midnight there.
    expect(todayEasternKey(new Date('2026-07-22T03:59:00Z'))).toBe('2026-07-21')
  })
})

describe('hasPostedToday', () => {
  const now = new Date('2026-07-21T23:30:00Z') // 7:30pm Eastern, 2026-07-21

  it('true when a row posted_at falls on today (Eastern)', () => {
    const rows = [{ posted_at: '2026-07-21T18:00:00Z' }]
    expect(hasPostedToday(rows, now)).toBe(true)
  })

  it('false when no row posted_at falls on today (Eastern)', () => {
    const rows = [{ posted_at: '2026-07-20T18:00:00Z' }]
    expect(hasPostedToday(rows, now)).toBe(false)
  })

  it('false when posted_at is null', () => {
    const rows = [{ posted_at: null }]
    expect(hasPostedToday(rows, now)).toBe(false)
  })

  it('false for an empty row list', () => {
    expect(hasPostedToday([], now)).toBe(false)
  })

  it('true if any one of several rows matches today, even if others do not', () => {
    const rows = [{ posted_at: '2026-07-19T12:00:00Z' }, { posted_at: '2026-07-21T12:00:00Z' }]
    expect(hasPostedToday(rows, now)).toBe(true)
  })
})
