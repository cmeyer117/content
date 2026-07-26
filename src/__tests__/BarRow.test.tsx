import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import BarRow from '@/components/BarRow'

describe('BarRow', () => {
  it('renders label and count, bar width proportional to count/max', () => {
    const { container } = render(<BarRow label="Training" count={3} max={10} color="#7f1d1d" />)
    expect(screen.getByText('Training')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    const bar = container.querySelector('[style*="width"]')
    expect(bar?.getAttribute('style')).toContain('30%')
  })

  it('renders a zero-width bar without dividing by zero when max is 0', () => {
    const { container } = render(<BarRow label="Diet" count={0} max={0} color="#713f12" />)
    const bar = container.querySelector('[style*="width"]')
    expect(bar?.getAttribute('style')).toContain('0%')
  })

  it('renders a decorative icon (empty alt, aria-hidden) when one is provided', () => {
    const { container } = render(<BarRow label="Training" count={3} max={10} color="#7f1d1d" icon="/training.png" />)
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img?.getAttribute('src')).toBe('/training.png')
    expect(img?.getAttribute('alt')).toBe('')
    expect(img?.getAttribute('aria-hidden')).toBe('true')
  })

  it('renders no img element when icon is omitted', () => {
    const { container } = render(<BarRow label="Training" count={3} max={10} color="#7f1d1d" />)
    expect(container.querySelector('img')).toBeNull()
  })
})
