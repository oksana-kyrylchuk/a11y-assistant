import { useEffect, useState } from 'react'
import { parseExplanation } from '../lib/explanation'
import { clearHighlight, highlightNode } from '../lib/highlight'
import { requestExplanation } from '../lib/messages'
import {
  countElements,
  groupBySeverity,
  type Issue,
  type IssueNode,
  type Severity,
} from '../lib/results'
import {
  getActiveTab,
  NoTabAccessError,
  scanActiveTab,
  type ScanResult,
} from '../lib/scan'
import { Settings } from './Settings'

type ScanState =
  | { status: 'idle'; note?: string }
  | { status: 'scanning' }
  | { status: 'error'; message: string }
  | { status: 'done'; result: ScanResult }

type Explanation =
  | { status: 'loading' }
  | { status: 'done'; text: string }
  | { status: 'error'; message: string }

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

function withoutHash(url: string) {
  return url.split('#')[0]
}

export function App() {
  const [state, setState] = useState<ScanState>({ status: 'idle' })
  // Key of the element currently highlighted on the page.
  const [selected, setSelected] = useState<string | null>(null)
  const [highlightError, setHighlightError] = useState<string | null>(null)
  // Explanations by element key. They belong to the current results.
  const [explanations, setExplanations] = useState<Record<string, Explanation>>(
    {},
  )

  const result = state.status === 'done' ? state.result : null

  // Results describe one page in one tab. Drop them as soon as the user
  // looks at another tab or the page is replaced.
  useEffect(() => {
    if (!result) return
    const { tabId, url } = result

    function reset(note: string) {
      setState({ status: 'idle', note })
      setSelected(null)
      setHighlightError(null)
      setExplanations({})
    }

    async function handleActivated() {
      const tab = await getActiveTab()
      if (tab?.id === tabId) return
      // The scanned tab is still open in the background: tidy it up.
      clearHighlight(tabId).catch(() => {})
      reset('Results cleared: you switched to another tab.')
    }

    function handleUpdated(
      updatedTabId: number,
      change: chrome.tabs.OnUpdatedInfo,
    ) {
      if (updatedTabId !== tabId || change.status !== 'loading') return
      // Every navigation reports "loading": a reload without a URL, anything
      // else with the new one. Jumping to an anchor keeps the same document.
      const sameDocument =
        change.url !== undefined &&
        withoutHash(change.url) === withoutHash(url)
      if (!sameDocument) reset('Results cleared: the page has changed.')
    }

    chrome.tabs.onActivated.addListener(handleActivated)
    chrome.tabs.onUpdated.addListener(handleUpdated)
    return () => {
      chrome.tabs.onActivated.removeListener(handleActivated)
      chrome.tabs.onUpdated.removeListener(handleUpdated)
    }
  }, [result])

  async function handleScan() {
    setState({ status: 'scanning' })
    setSelected(null)
    setHighlightError(null)
    setExplanations({})
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

  async function handleExplain(key: string, issue: Issue, node: IssueNode) {
    const update = (explanation: Explanation) =>
      setExplanations((current) => ({ ...current, [key]: explanation }))

    update({ status: 'loading' })
    try {
      const reply = await requestExplanation({
        ruleId: issue.ruleId,
        help: issue.help,
        failureSummary: node.failureSummary,
        html: node.html,
      })
      update(
        reply.ok
          ? { status: 'done', text: reply.text }
          : { status: 'error', message: reply.message },
      )
    } catch {
      update({
        status: 'error',
        message: 'Could not reach the extension background. Reload the extension.',
      })
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
        {state.status === 'idle' && (state.note ?? 'No scan yet.')}
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
        <Results
          result={result}
          selected={selected}
          explanations={explanations}
          onSelect={handleSelect}
          onExplain={handleExplain}
        />
      )}

      <Settings />
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
  explanations: Record<string, Explanation>
  onSelect: (key: string, node: IssueNode) => void
  onExplain: (key: string, issue: Issue, node: IssueNode) => void
}

function Results({
  result,
  selected,
  explanations,
  onSelect,
  onExplain,
}: ResultsProps) {
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
                    const explanation = explanations[key]
                    return (
                      <li key={key}>
                        <div className="node-row">
                          <button
                            type="button"
                            className="node"
                            aria-pressed={selected === key}
                            onClick={() => onSelect(key, node)}
                          >
                            <code>{node.selector}</code>
                          </button>
                          <button
                            type="button"
                            className="explain"
                            aria-label={`Explain ${issue.ruleId} on ${node.selector}`}
                            disabled={explanation?.status === 'loading'}
                            onClick={() => onExplain(key, issue, node)}
                          >
                            Explain
                          </button>
                        </div>
                        <ExplanationView explanation={explanation} />
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

function ExplanationView({ explanation }: { explanation?: Explanation }) {
  // The live region is always present, so screen readers announce changes.
  return (
    <div className="explanation" aria-live="polite">
      {explanation?.status === 'loading' && (
        <p className="status">Asking Gemini…</p>
      )}
      {explanation?.status === 'error' && (
        <p className="error">{explanation.message}</p>
      )}
      {explanation?.status === 'done' &&
        parseExplanation(explanation.text).map((block, index) =>
          block.type === 'code' ? (
            <pre key={index}>
              <code>{block.content}</code>
            </pre>
          ) : (
            <p key={index}>{block.content}</p>
          ),
        )}
    </div>
  )
}
