import { useEffect, useState, type FormEvent } from 'react'
import {
  DEFAULT_MODEL,
  getSettings,
  onSettingsChanged,
  saveSettings,
} from '../lib/settings'

/** Settings for the optional "Explain" feature. Scanning works without them. */
export function Settings() {
  const [savedKey, setSavedKey] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [status, setStatus] = useState('')

  useEffect(() => {
    function load() {
      getSettings().then((settings) => {
        setSavedKey(settings.apiKey)
        setModel(settings.model)
      })
    }
    load()
    return onSettingsChanged(load)
  }, [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    // An empty key field keeps the saved key, so the model can be changed
    // without typing the key again.
    await saveSettings({ apiKey: apiKey || savedKey, model })
    setApiKey('')
    setStatus('Settings saved.')
  }

  async function handleRemove() {
    await saveSettings({ apiKey: '', model })
    setApiKey('')
    setStatus('API key removed.')
  }

  return (
    <details className="settings">
      <summary>Settings</summary>
      <form onSubmit={handleSubmit}>
        <p>
          “Explain” asks Google Gemini why an issue matters and how to fix it.
          It needs your own API key from Google AI Studio.
        </p>

        <label htmlFor="api-key">Gemini API key</label>
        <input
          id="api-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={apiKey}
          placeholder={savedKey ? 'Enter a new key to replace the saved one' : ''}
          aria-describedby="api-key-hint"
          onChange={(event) => setApiKey(event.target.value)}
        />
        <p id="api-key-hint" className="hint">
          {savedKey
            ? `A key ending in ${savedKey.slice(-4)} is saved.`
            : 'No key saved.'}{' '}
          The key is stored only in this browser and is sent only to Google.
        </p>

        <label htmlFor="model">Model</label>
        <input
          id="model"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={model}
          onChange={(event) => setModel(event.target.value)}
        />

        <p className="hint">
          Explaining an issue sends its rule and the HTML of the element to
          Google. On the free tier Google may use this content to improve its
          products.
        </p>

        <div className="actions">
          <button type="submit">Save</button>
          {savedKey && (
            <button type="button" onClick={handleRemove}>
              Remove key
            </button>
          )}
        </div>
        <p className="hint" role="status">
          {status}
        </p>
      </form>
    </details>
  )
}
