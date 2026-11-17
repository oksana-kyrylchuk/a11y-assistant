/** Settings live in chrome.storage.local: on this device only, never synced. */

// A Flash-Lite model: answers in about a second. Larger Flash models can take
// longer than the 25-second limit an extension service worker allows.
export const DEFAULT_MODEL = 'gemini-3.5-flash-lite'

const API_KEY = 'geminiApiKey'
const MODEL = 'geminiModel'

export interface Settings {
  /** Empty string when no key is saved. */
  apiKey: string
  model: string
}

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get([API_KEY, MODEL])
  const apiKey = stored[API_KEY]
  const model = stored[MODEL]
  return {
    apiKey: typeof apiKey === 'string' ? apiKey : '',
    model: typeof model === 'string' && model ? model : DEFAULT_MODEL,
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  const apiKey = settings.apiKey.trim()
  const model = settings.model.trim()
  if (apiKey) {
    await chrome.storage.local.set({ [API_KEY]: apiKey })
  } else {
    await chrome.storage.local.remove(API_KEY)
  }
  if (model && model !== DEFAULT_MODEL) {
    await chrome.storage.local.set({ [MODEL]: model })
  } else {
    await chrome.storage.local.remove(MODEL)
  }
}

export function onSettingsChanged(listener: () => void): () => void {
  function handleChange(_changes: unknown, area: string) {
    if (area === 'local') listener()
  }
  chrome.storage.onChanged.addListener(handleChange)
  return () => chrome.storage.onChanged.removeListener(handleChange)
}
