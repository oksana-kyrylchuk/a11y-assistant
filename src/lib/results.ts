import type { Result } from 'axe-core'

export const SEVERITIES = ['critical', 'serious', 'moderate', 'minor'] as const
export type Severity = (typeof SEVERITIES)[number]

export interface IssueNode {
  /** CSS selector path to the element, as reported by axe. */
  target: string
  html: string
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
      // Each entry is one frame or shadow-root step on the way to the element.
      target: node.target.flat().join(' '),
      html: node.html,
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
