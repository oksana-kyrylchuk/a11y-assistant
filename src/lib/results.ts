import type { NodeResult, Result } from 'axe-core'

export const SEVERITIES = ['critical', 'serious', 'moderate', 'minor'] as const
export type Severity = (typeof SEVERITIES)[number]

export interface IssueNode {
  /**
   * Path to the element as reported by axe: one entry per frame, where an
   * entry is either a CSS selector or a list of selectors through shadow roots.
   */
  target: NodeResult['target']
  /** The same path as a single string, for display. */
  selector: string
  html: string
  /** What axe says is wrong with this element. */
  failureSummary: string
}

export interface Issue {
  ruleId: string
  severity: Severity
  help: string
  helpUrl: string
  nodes: IssueNode[]
}

export interface SeverityGroup {
  severity: Severity
  issues: Issue[]
}

export function toIssues(violations: Result[]): Issue[] {
  return violations.map((violation) => ({
    ruleId: violation.id,
    severity: violation.impact ?? 'minor',
    help: violation.help,
    helpUrl: violation.helpUrl,
    nodes: violation.nodes.map((node) => ({
      target: node.target,
      selector: node.target.flat().join(' '),
      html: node.html,
      failureSummary: node.failureSummary ?? '',
    })),
  }))
}

/** Groups issues from most to least severe, leaving out empty groups. */
export function groupBySeverity(issues: Issue[]): SeverityGroup[] {
  return SEVERITIES.map((severity) => ({
    severity,
    issues: issues.filter((issue) => issue.severity === severity),
  })).filter((group) => group.issues.length > 0)
}

export function countElements(issues: Issue[]): number {
  return issues.reduce((total, issue) => total + issue.nodes.length, 0)
}
