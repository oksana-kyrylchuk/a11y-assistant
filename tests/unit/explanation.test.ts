import { describe, expect, it } from 'vitest'
import { parseExplanation } from '../../src/lib/explanation'

describe('parseExplanation', () => {
  it('splits paragraphs and fenced code, dropping the language tag', () => {
    const answer = [
      'A button without text has no name.',
      '',
      'Screen reader users hear only "button".',
      '',
      '```html',
      '<button aria-label="Close"></button>',
      '```',
    ].join('\n')
    expect(parseExplanation(answer)).toEqual([
      { type: 'text', content: 'A button without text has no name.' },
      { type: 'text', content: 'Screen reader users hear only "button".' },
      { type: 'code', content: '<button aria-label="Close"></button>' },
    ])
  })

  it('keeps text after a code block', () => {
    expect(parseExplanation('Before\n```\n<p></p>\n```\nAfter')).toEqual([
      { type: 'text', content: 'Before' },
      { type: 'code', content: '<p></p>' },
      { type: 'text', content: 'After' },
    ])
  })

  it('shows markup from the model as text, never as HTML', () => {
    const [block] = parseExplanation('<img src=x onerror=alert(1)>')
    expect(block).toEqual({ type: 'text', content: '<img src=x onerror=alert(1)>' })
  })

  it('returns nothing for an empty answer', () => {
    expect(parseExplanation('  \n\n ')).toEqual([])
  })
})
