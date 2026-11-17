import type { Result } from 'axe-core'
import { describe, expect, it } from 'vitest'
import { countElements, groupBySeverity, toIssues } from '../../src/lib/results'

function violation(overrides: Partial<Result>): Result {
  return {
    id: 'rule',
    impact: 'serious',
    description: '',
    help: 'Help text',
    helpUrl: 'https://example.com/rule',
    tags: [],
    nodes: [],
    ...overrides,
  }
}

function node(target: Result['nodes'][number]['target'], failureSummary?: string) {
  return { html: '<b></b>', target, any: [], all: [], none: [], failureSummary }
}

describe('toIssues', () => {
  it('keeps the rule details and each element', () => {
    const [issue] = toIssues([
      violation({
        id: 'image-alt',
        impact: 'critical',
        help: 'Images must have alternative text',
        nodes: [node(['#swatch'], 'Fix any of the following: …')],
      }),
    ])
    expect(issue).toEqual({
      ruleId: 'image-alt',
      severity: 'critical',
      help: 'Images must have alternative text',
      helpUrl: 'https://example.com/rule',
      nodes: [
        {
          target: ['#swatch'],
          selector: '#swatch',
          html: '<b></b>',
          failureSummary: 'Fix any of the following: …',
        },
      ],
    })
  })

  it('treats a missing impact as minor', () => {
    expect(toIssues([violation({ impact: null })])[0]!.severity).toBe('minor')
    expect(toIssues([violation({ impact: undefined })])[0]!.severity).toBe('minor')
  })

  it('joins a path through shadow roots into one selector', () => {
    const [issue] = toIssues([violation({ nodes: [node([['#host', '#inner']])] })])
    expect(issue!.nodes[0]!.target).toEqual([['#host', '#inner']])
    expect(issue!.nodes[0]!.selector).toBe('#host #inner')
  })

  it('uses an empty failure summary when axe gives none', () => {
    const [issue] = toIssues([violation({ nodes: [node(['p'])] })])
    expect(issue!.nodes[0]!.failureSummary).toBe('')
  })
})

describe('groupBySeverity', () => {
  it('orders groups from critical to minor and leaves out empty ones', () => {
    const issues = toIssues([
      violation({ id: 'a', impact: 'minor' }),
      violation({ id: 'b', impact: 'critical' }),
      violation({ id: 'c', impact: 'minor' }),
    ])
    const groups = groupBySeverity(issues)
    expect(groups.map((group) => group.severity)).toEqual(['critical', 'minor'])
    expect(groups[1]!.issues.map((issue) => issue.ruleId)).toEqual(['a', 'c'])
  })

  it('returns no groups for no issues', () => {
    expect(groupBySeverity([])).toEqual([])
  })
})

describe('countElements', () => {
  it('counts elements across all issues', () => {
    const issues = toIssues([
      violation({ nodes: [node(['a']), node(['b'])] }),
      violation({ nodes: [node(['c'])] }),
    ])
    expect(countElements(issues)).toBe(3)
  })
})
