import type { IssueNode } from './results'

/** Id of the overlay element drawn on the page around the selected element. */
export const HIGHLIGHT_ID = 'a11y-assistant-highlight'

/**
 * Scrolls the page to the element and draws an outline around it.
 * Resolves to false when the element is no longer on the page.
 */
export async function highlightNode(
  tabId: number,
  node: IssueNode,
): Promise<boolean> {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    args: [node.target, HIGHLIGHT_ID],
    // Runs in the page: must not reference anything outside its own body.
    func: (target: IssueNode['target'], highlightId: string) => {
      document.getElementById(highlightId)?.remove()

      // More than one entry means the element is inside a frame, and only
      // the top document is scanned.
      if (target.length !== 1) return false
      const step = target[0]!
      const path = typeof step === 'string' ? [step] : step

      let root: Document | ShadowRoot = document
      let element: Element | null = null
      for (const [index, selector] of path.entries()) {
        element = root.querySelector(selector)
        if (!element) return false
        if (index < path.length - 1) {
          if (!element.shadowRoot) return false
          root = element.shadowRoot
        }
      }
      if (!element) return false

      const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
      element.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: reduceMotion ? 'auto' : 'smooth',
      })

      // Positioned in document coordinates, so it scrolls with the page.
      // Empty elements have no size: give them a visible minimum.
      const rect = element.getBoundingClientRect()
      const padding = 4
      const width = Math.max(rect.width, 8) + padding * 2
      const height = Math.max(rect.height, 8) + padding * 2
      const overlay = document.createElement('div')
      overlay.id = highlightId
      overlay.setAttribute('aria-hidden', 'true')
      overlay.style.cssText = [
        'all: initial',
        'position: absolute',
        'z-index: 2147483647',
        'pointer-events: none',
        'box-sizing: border-box',
        `top: ${Math.max(rect.top + window.scrollY - padding, 0)}px`,
        `left: ${Math.max(rect.left + window.scrollX - padding, 0)}px`,
        `width: ${width}px`,
        `height: ${height}px`,
        'border: 3px solid #d6006e',
        'border-radius: 4px',
        // White rings keep the outline visible on dark and on pink pages.
        'box-shadow: 0 0 0 2px #fff, inset 0 0 0 2px #fff',
      ].join(';')
      document.documentElement.append(overlay)
      return true
    },
  })
  return injection?.result ?? false
}

export async function clearHighlight(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    args: [HIGHLIGHT_ID],
    func: (highlightId: string) => {
      document.getElementById(highlightId)?.remove()
    },
  })
}
