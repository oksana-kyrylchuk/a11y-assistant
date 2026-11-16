import { useState } from 'react'
import { countElements, groupBySeverity, type Severity } from '../lib/results'
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

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

export function App() {
  const [state, setState] = useState<ScanState>({ status: 'idle' })

  async function handleScan() {
    setState({ status: 'scanning' })
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

  return (
    <main>
      <h1>Accessibility Assistant</h1>
      <p>Checks the page in the active tab for accessibility issues.</p>
      <button
        type="button"
        onClick={handleScan}
        disabled={state.status === 'scanning'}
      >
        {state.status === 'done' ? 'Scan again' : 'Scan page'}
      </button>

      <p className="status" role="status">
        {state.status === 'idle' && 'No scan yet.'}
        {state.status === 'scanning' && 'Scanning…'}
        {state.status === 'done' && <Summary result={state.result} />}
      </p>
      {state.status === 'error' && (
        <p className="error" role="alert">
          {state.message}
        </p>
      )}

      {state.status === 'done' && <Results result={state.result} />}
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
    </>
  )
}

function Results({ result }: { result: ScanResult }) {
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
                  {issue.nodes.map((node) => (
                    <li key={node.target}>
                      <code>{node.target}</code>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}
