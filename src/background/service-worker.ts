import { explain, ExplainError } from '../lib/gemini'
import type { ExplainMessage, ExplainReply } from '../lib/messages'
import { getSettings } from '../lib/settings'

// Open the side panel when the toolbar icon is clicked.
//
// This uses action.onClicked instead of
// sidePanel.setPanelBehavior({ openPanelOnActionClick: true }) on purpose:
// with the declarative behavior the click opens the panel but does not grant
// activeTab, so the panel cannot inject scripts into the page.
chrome.action.onClicked.addListener((tab) => {
  // Must be called synchronously to stay inside the user gesture.
  chrome.sidePanel
    .open({ windowId: tab.windowId })
    .catch((error: unknown) => console.error(error))
})

// The panel behavior is stored in the browser profile and survives extension
// updates, so switch it off explicitly: while it is on, action.onClicked
// never fires.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: false })
  .catch((error: unknown) => console.error(error))

// Keep the API key out of reach of scripts injected into pages: only
// extension pages and this worker may read storage.
chrome.storage.local
  .setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
  .catch((error: unknown) => console.error(error))

async function handleExplain(message: ExplainMessage): Promise<ExplainReply> {
  const { apiKey, model } = await getSettings()
  if (!apiKey) {
    return {
      ok: false,
      message: 'Add a Gemini API key in Settings to get explanations.',
    }
  }
  try {
    return { ok: true, text: await explain(apiKey, model, message.input) }
  } catch (error) {
    if (error instanceof ExplainError) {
      return { ok: false, message: error.message }
    }
    console.error(error)
    return { ok: false, message: 'Something went wrong while asking Gemini.' }
  }
}

// The request to the LLM is made here, not in the side panel, so the key is
// only ever attached to requests by the service worker.
chrome.runtime.onMessage.addListener(
  (message: ExplainMessage, sender, sendResponse) => {
    // Only accept messages from this extension's own pages.
    if (sender.id !== chrome.runtime.id || message?.type !== 'explain') return
    handleExplain(message).then(sendResponse)
    // Keep the channel open for the asynchronous reply.
    return true
  },
)
