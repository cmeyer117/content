import { describe, it, expect } from 'vitest'
import { todayEasternKey, hasPostedToday, pickTopReadyIdea, buildNudgeMessage } from './posting-cadence-logic.js'

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

describe('pickTopReadyIdea', () => {
  it('returns null for an empty list', () => {
    expect(pickTopReadyIdea([])).toBeNull()
  })

  it('picks the READY idea with the highest predicted_score', () => {
    const rows = [
      { id: 'a', title: 'A', predicted_score: 6 },
      { id: 'b', title: 'B', predicted_score: 9 },
      { id: 'c', title: 'C', predicted_score: 7 },
    ]
    expect(pickTopReadyIdea(rows).id).toBe('b')
  })

  it('ties — keeps the first row in input order', () => {
    const rows = [
      { id: 'a', title: 'A', predicted_score: 8 },
      { id: 'b', title: 'B', predicted_score: 8 },
    ]
    expect(pickTopReadyIdea(rows).id).toBe('a')
  })

  it('missing predicted_score ranks below any scored idea', () => {
    const rows = [
      { id: 'a', title: 'A', predicted_score: null },
      { id: 'b', title: 'B' },
      { id: 'c', title: 'C', predicted_score: 1 },
    ]
    expect(pickTopReadyIdea(rows).id).toBe('c')
  })

  it('all missing predicted_score — still names one (the first)', () => {
    const rows = [{ id: 'a', title: 'A', predicted_score: null }, { id: 'b', title: 'B' }]
    expect(pickTopReadyIdea(rows).id).toBe('a')
  })
})

describe('buildNudgeMessage', () => {
  it('READY > 0 — names the top post, counts READY, and deep-links to that idea', () => {
    const rows = [
      { id: 'a', title: 'Low one', predicted_score: 3 },
      { id: 'b', title: 'Ship this one', predicted_score: 9 },
    ]
    const msg = buildNudgeMessage(rows)
    expect(msg.body).not.toContain('ET')
    expect(msg.body).toContain('Ship this one')
    expect(msg.body).toContain('2 ready')
    expect(msg.body).not.toContain('banked')
    expect(msg.url).toBe('/pipeline?idea=b')
  })

  it('READY = 0 — says nothing is approved and carries no link', () => {
    const msg = buildNudgeMessage([])
    expect(msg.body).toContain('Nothing approved yet, open the autopilot cards')
    expect(msg.body).not.toContain('ready')
    expect(msg.url).toBeUndefined()
  })

  it('tolerates a non-array (failed fetch) as zero READY', () => {
    const msg = buildNudgeMessage(undefined)
    expect(msg.body).toContain('Nothing approved yet')
    expect(msg.url).toBeUndefined()
  })

  it('tie on predicted_score names the first in input order', () => {
    const rows = [
      { id: 'a', title: 'First', predicted_score: 8 },
      { id: 'b', title: 'Second', predicted_score: 8 },
    ]
    expect(buildNudgeMessage(rows).body).toContain('First')
  })

  it('missing predicted_score everywhere still names a post', () => {
    const rows = [{ id: 'a', title: 'Only unscored' }]
    const msg = buildNudgeMessage(rows)
    expect(msg.body).toContain('Only unscored')
    expect(msg.body).toContain('1 ready')
    expect(msg.url).toBe('/pipeline?idea=a')
  })
})
