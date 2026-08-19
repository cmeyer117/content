import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ExperimentTable from '@/components/ExperimentTable'
import type { ExperimentRow } from '@/lib/experiments'

const rows: ExperimentRow[] = [
  { id: 'a', title: 'How to bench more', content_class: 'technique', hook: 'Stop doing this', target_length_seconds: 22, views: 100, likes: 10, shares: 2, saves: 5, metricool_engagement_rate: 4.2 },
]

describe('ExperimentTable', () => {
  it('renders a row per tagged idea with its title and metrics', () => {
    render(<ExperimentTable rows={rows} />)
    expect(screen.getByText('How to bench more')).toBeTruthy()
    expect(screen.getByText('technique')).toBeTruthy()
    expect(screen.getByText('100')).toBeTruthy()
  })

  it('shows an em dash for null fields instead of blank cells', () => {
    const nullRow: ExperimentRow = { id: 'b', title: 'Untagged draft', content_class: null, hook: null, target_length_seconds: null, views: null, likes: null, shares: null, saves: null, metricool_engagement_rate: null }
    render(<ExperimentTable rows={[nullRow]} />)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('shows an empty-state message when there are no rows', () => {
    render(<ExperimentTable rows={[]} />)
    expect(screen.getByText(/no ideas tagged/i)).toBeTruthy()
  })
})
