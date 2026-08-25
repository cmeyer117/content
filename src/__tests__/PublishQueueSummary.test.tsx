import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PublishQueueSummary from '@/components/PublishQueueSummary'
import type { ContentIdea } from '@/types/content'

function makeIdea(overrides: Partial<ContentIdea>): ContentIdea {
  return {
    id: 'x', title: 't', body: null, pillar: 'training', platform: 'tiktok', status: 'SCHEDULED',
    hook: null, content_class: null, hook_first_2s: null, viewer_payoff: null,
    target_length_seconds: null, length_justification: null, diary_justification: null,
    notes: null, scheduled_at: null, publish_at: null, posted_at: null, idea_score: null, idea_score_notes: null,
    execution_score: null, execution_score_notes: null, predicted_score: null,
    predicted_reasoning: null, predicted_at: null, prediction_version: null,
    source_intel_insight_id: null, experiment_id: null,
    series_source_performance_id: null, angle: null, position: null,
    created_at: '2026-01-01T12:00:00Z',
    ...overrides,
  }
}

const NOW = new Date('2026-08-25T16:00:00.000Z')

function renderSummary(ideas: ContentIdea[]) {
  return render(
    <MemoryRouter>
      <PublishQueueSummary ideas={ideas} now={NOW} />
    </MemoryRouter>
  )
}

describe('PublishQueueSummary', () => {
  it('renders nothing when there are no SCHEDULED ideas', () => {
    const { container } = renderSummary([makeIdea({ status: 'DRAFT' })])
    expect(container.firstChild).toBeNull()
  })

  it('renders distinct counts for overdue, ready today, and needs-time, with a link to /queue', () => {
    const ideas = [
      makeIdea({ id: 'overdue', publish_at: '2026-08-25T10:00:00.000Z' }),
      makeIdea({ id: 'today', publish_at: '2026-08-25T22:00:00.000Z' }),
      makeIdea({ id: 'needs', publish_at: null }),
    ]
    renderSummary(ideas)
    expect(screen.getByText(/1 overdue/i)).toBeTruthy()
    expect(screen.getByText(/1 ready today/i)).toBeTruthy()
    expect(screen.getByText(/1 needs a publish time/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: /queue/i }).getAttribute('href')).toBe('/queue')
  })

  it('does not create a prominent card for a future-week item alone', () => {
    const ideas = [makeIdea({ id: 'upcoming', publish_at: '2026-08-27T22:00:00.000Z' })]
    const { container } = renderSummary(ideas)
    expect(container.firstChild).toBeNull()
  })
})
