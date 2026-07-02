import { describe, it, expect } from 'vitest'
import { extractTakeaway } from '@/lib/intel'

const BRIEF = `## 1. HOOK PATTERNS
They open with a bold claim.

## 2. TOP TOPICS
Protein myths.

## 6. CARL'S TAKEAWAY
Post a car rant this week: "Why your cut is failing" — tie it to the trending topic of mini-cuts. Open with the number on the scale.
`

describe('extractTakeaway', () => {
  it('pulls the takeaway section body', () => {
    const t = extractTakeaway(BRIEF)
    expect(t).toContain('Why your cut is failing')
    expect(t).not.toContain('HOOK PATTERNS')
  })

  it('stops at the next heading', () => {
    const brief = `## 6. CARL'S TAKEAWAY\nDo the thing.\n\n## 7. EXTRA\nIgnore me.`
    expect(extractTakeaway(brief)).toBe('Do the thing.')
  })

  it('matches TAKEAWAY case-insensitively with varied numbering', () => {
    const brief = `### Carl's Takeaway\nFilm at the gym.`
    expect(extractTakeaway(brief)).toBe('Film at the gym.')
  })

  it('returns null when no takeaway section exists', () => {
    expect(extractTakeaway('## 1. HOOKS\nstuff')).toBeNull()
  })
})
