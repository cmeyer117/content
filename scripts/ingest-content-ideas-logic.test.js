import { describe, it, expect } from 'vitest'
import { filterNewIdeas } from './ingest-content-ideas-logic.js'

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

  it('works with non-training pillars and provenance notes, proving the filter is not Row-specific', () => {
    const ideas = [
      {
        title: 'Discipline is a rehearsed response, not a personality trait',
        body: 'Frankl and the Stoics both land on the same mechanism: the gap between stimulus and response is where discipline actually lives.',
        pillar: 'mindset',
        notes: 'Source: [[Discipline & the Accountability Mirror]] · verified',
      },
      {
        title: 'Already in the bank',
        body: 'placeholder',
        pillar: 'faith',
      },
    ]
    const existingTitles = new Set(['Already in the bank'])
    expect(filterNewIdeas(ideas, existingTitles)).toEqual([
      {
        title: 'Discipline is a rehearsed response, not a personality trait',
        body: 'Frankl and the Stoics both land on the same mechanism: the gap between stimulus and response is where discipline actually lives.',
        pillar: 'mindset',
        notes: 'Source: [[Discipline & the Accountability Mirror]] · verified',
      },
    ])
  })
})
