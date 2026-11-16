import type axeCore from 'axe-core'
import { toIssues, type Issue } from './results'

// Global defined in the page's isolated world once axe.min.js is injected.
declare const axe: typeof axeCore

export interface ScanResult {
  pageTitle: string
  issues: Issue[]
}

export class NoTabAccessError extends Error {}

export async function scanActiveTab(): Promise<ScanResult> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  // Without the "tabs" permission the URL is only visible while activeTab is
  // granted for this tab, so a missing URL means the page is out of reach.
  if (tab?.id === undefined || !tab.url) {
    throw new NoTabAccessError()
  }

  const target = { tabId: tab.id }
  await chrome.scripting.executeScript({ target, files: ['axe.min.js'] })
  const [injection] = await chrome.scripting.executeScript({
    target,
    // Runs in the page: must not reference anything outside its own body.
    func: async () => {
      const results = await axe.run(document, { resultTypes: ['violations'] })
      return results.violations
    },
  })

  return {
    pageTitle: tab.title || tab.url,
    issues: toIssues(injection?.result ?? []),
  }
}
