import { describe, it, expect } from 'vitest'
import { filterNewIdeas } from './ingest-row-ideas-logic.js'

describe('filterNewIdeas', () => {
  it('keeps ideas whose title is not already in the existing set', () => {
    const ideas = [
      { title: 'A', body: 'a', pillar: 'training' },
      { title: 'B', body: 'b', pillar: 'training' },
    ]
    const existingTitles = new Set(['A'])
    expect(filterNewIdeas(ideas, existingTitles)).toEqual([
      { title: 'B', body: 'b', pillar: 'training' },
    ])
  })

  it('returns empty array when every title already exists', () => {
    const ideas = [{ title: 'A', body: 'a', pillar: 'training' }]
    const existingTitles = new Set(['A'])
    expect(filterNewIdeas(ideas, existingTitles)).toEqual([])
  })

  it('returns all ideas when existing set is empty', () => {
    const ideas = [{ title: 'A', body: 'a', pillar: 'training' }]
    expect(filterNewIdeas(ideas, new Set())).toEqual(ideas)
  })
})
