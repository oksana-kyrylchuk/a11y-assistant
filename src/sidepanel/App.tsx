import { useState } from 'react'
import { highlightNode } from '../lib/highlight'
import {
  countElements,
  groupBySeverity,
  type IssueNode,
  type Severity,
} from '../lib/results'
import { NoTabAccessError, scanActiveTab, type ScanResult } from '../lib/scan'

type ScanState =
  | { status: 'idle' }
  | { status: 'scanning' }
  | { status: 'error'; message: string }
  | { status: 'done'; result: ScanResult }

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: 'Critical',
  serious: 'Serious',
  moderate: 'Moderate',
  minor: 'Minor',
}

const NO_ACCESS_MESSAGE =
  'No access to this tab. Click the extension icon in the toolbar while the tab is open, then scan again. Browser pages such as settings or the extension store cannot be scanned.'

const ELEMENT_NOT_FOUND_MESSAGE =
  'This element is no longer on the page. Scan again to refresh the list.'

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

export function App() {
  const [state, setState] = useState<ScanState>({ status: 'idle' })
  // Key of the element currently highlighted on the page.
  const [selected, setSelected] = useState<string | null>(null)
  const [highlightError, setHighlightError] = useState<string | null>(null)

  const result = state.status === 'done' ? state.result : null

  async function handleScan() {
    setState({ status: 'scanning' })
    setSelected(null)
    setHighlightError(null)
    try {
      setState({ status: 'done', result: await scanActiveTab() })
    } catch (error) {
      const message =
        error instanceof NoTabAccessError
          ? NO_ACCESS_MESSAGE
          : `The scan failed: ${error instanceof Error ? error.message : String(error)}`
      setState({ status: 'error', message })
    }
  }

  async function handleSelect(key: string, node: IssueNode) {
    if (!result) return
    setHighlightError(null)
    try {
      const found = await highlightNode(result.tabId, node)
      setSelected(found ? key : null)
      if (!found) setHighlightError(ELEMENT_NOT_FOUND_MESSAGE)
    } catch (error) {
      setSelected(null)
      setHighlightError(
        `Could not highlight the element: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  return (
    <main>
      <h1>Accessibility Assistant</h1>
      <p>Checks the page in the active tab for accessibility issues.</p>
      <button
        type="button"
        className="scan"
        onClick={handleScan}
        disabled={state.status === 'scanning'}
      >
        {state.status === 'done' ? 'Scan again' : 'Scan page'}
      </button>

      <p className="status" role="status">
        {state.status === 'idle' && 'No scan yet.'}
        {state.status === 'scanning' && 'Scanning…'}
        {result && <Summary result={result} />}
      </p>
      {state.status === 'error' && (
        <p className="error" role="alert">
          {state.message}
        </p>
      )}
      {highlightError && (
        <p className="error" role="alert">
          {highlightError}
        </p>
      )}

      {result && (
        <Results result={result} selected={selected} onSelect={handleSelect} />
      )}
    </main>
  )
}

function Summary({ result }: { result: ScanResult }) {
  const { issues, pageTitle } = result
  if (issues.length === 0) {
    return <>No issues found on “{pageTitle}”.</>
  }
  return (
    <>
      {plural(issues.length, 'issue')} on{' '}
      {plural(countElements(issues), 'element')} found on “{pageTitle}”.
      Select an element to show it on the page.
    </>
  )
}

interface ResultsProps {
  result: ScanResult
  selected: string | null
  onSelect: (key: string, node: IssueNode) => void
}

function Results({ result, selected, onSelect }: ResultsProps) {
  return (
    <>
      {groupBySeverity(result.issues).map(({ severity, issues }) => (
        <section key={severity} aria-labelledby={`severity-${severity}`}>
          <h2 id={`severity-${severity}`} className={`severity ${severity}`}>
            {SEVERITY_LABELS[severity]} ({issues.length})
          </h2>
          <ul className="issues">
            {issues.map((issue) => (
              <li key={issue.ruleId} className="issue">
                <h3>{issue.help}</h3>
                <p className="rule">
                  <a href={issue.helpUrl} target="_blank" rel="noreferrer">
                    {issue.ruleId}
                  </a>{' '}
                  · {plural(issue.nodes.length, 'element')}
                </p>
                <ul className="nodes">
                  {issue.nodes.map((node) => {
                    const key = `${issue.ruleId} ${node.selector}`
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          className="node"
                          aria-pressed={selected === key}
                          onClick={() => onSelect(key, node)}
                        >
                          <code>{node.selector}</code>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}
