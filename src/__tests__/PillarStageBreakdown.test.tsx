import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import PillarStageBreakdown from '@/components/PillarStageBreakdown'
import { countByPillarAndStage } from '@/lib/chartData'
import type { ContentIdea } from '@/types/content'

function makeIdea(overrides: Partial<ContentIdea>): ContentIdea {
  return {
    id: 'x', title: 't', body: null, pillar: 'training', platform: 'tiktok', status: 'IDEA',
    hook: null, notes: null, scheduled_at: null, posted_at: null, views: null, likes: null,
    shares: null, saves: null, post_url: null, idea_score: null, idea_score_notes: null,
    execution_score: null, execution_score_notes: null, created_at: '2026-01-01T12:00:00Z',
    ...overrides,
  }
}

describe('PillarStageBreakdown', () => {
  it('renders one row per pillar with its total count', () => {
    const data = countByPillarAndStage([
      makeIdea({ pillar: 'training', status: 'IDEA' }),
      makeIdea({ pillar: 'training', status: 'DRAFT' }),
      makeIdea({ pillar: 'faith', status: 'TRACKED' }),
    ])
    render(<PillarStageBreakdown data={data} />)
    // getByText('0') would throw here — diet/mindset/life are all empty
    // pillars, so three separate rows render the text "0". Scope each
    // assertion to its own row instead of a bare global text search.
    const trainingRow = screen.getByText('Training').closest('div')!
    expect(within(trainingRow).getByText('2')).toBeTruthy()
    const faithRow = screen.getByText('Faith').closest('div')!
    expect(within(faithRow).getByText('1')).toBeTruthy()
    const dietRow = screen.getByText('Diet').closest('div')!
    expect(within(dietRow).getByText('0')).toBeTruthy()
  })
})
