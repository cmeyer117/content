import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import EmptyState from '@/components/EmptyState'

describe('EmptyState', () => {
  it('renders the provided message', () => {
    render(<EmptyState message="No ideas yet." />)
    expect(screen.getByText('No ideas yet.')).toBeTruthy()
  })

  it('renders an icon when one is provided', () => {
    render(<EmptyState message="No ideas yet." icon="📭" />)
    expect(screen.getByText('📭')).toBeTruthy()
  })
})
