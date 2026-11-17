import type { BrowserContext, Page } from '@playwright/test'
import { expect, test } from './fixtures'

const GEMINI = 'https://generativelanguage.googleapis.com/**'
const ANSWER = [
  'A button without text has no accessible name.',
  '',
  'Screen reader users hear only "button".',
  '',
  '```html',
  '<button type="button" id="icon-button" aria-label="Close"></button>',
  '```',
].join('\n')

async function scanViolations(context: BrowserContext, openPanel: (page: Page) => Promise<Page>) {
  const page = await context.newPage()
  await page.goto('/violations.html')
  const panel = await openPanel(page)
  await panel.getByRole('button', { name: 'Scan page' }).click()
  await expect(panel.getByRole('status')).toContainText('9 issues')
  return { page, panel }
}

async function saveKey(panel: Page, key: string) {
  await panel.getByText('Settings', { exact: true }).click()
  await panel.getByLabel('Gemini API key').fill(key)
  await panel.getByRole('button', { name: 'Save' }).click()
  await expect(panel.locator('#api-key-hint')).toContainText(`ending in ${key.slice(-4)}`)
}

test('asks for an API key before explaining', async ({ context, openPanel }) => {
  let requests = 0
  await context.route(GEMINI, (route) => {
    requests++
    return route.abort()
  })
  const { panel } = await scanViolations(context, openPanel)

  await panel.getByRole('button', { name: 'Explain button-name on #icon-button' }).click()
  await expect(panel.locator('.explanation').first()).toHaveText(
    'Add a Gemini API key in Settings to get explanations.',
  )
  expect(requests).toBe(0)
})

test('explains an issue with the Gemini API', async ({ context, openPanel, serviceWorker }) => {
  const requests: { url: string; key?: string; prompt: string }[] = []
  // Requests from the extension service worker go through context routes.
  await context.route(GEMINI, (route) => {
    const request = route.request()
    requests.push({
      url: request.url(),
      key: request.headers()['x-goog-api-key'],
      prompt: request.postDataJSON().contents[0].parts[0].text,
    })
    return route.fulfill({
      json: { candidates: [{ content: { parts: [{ text: ANSWER }] } }] },
    })
  })
  const { panel } = await scanViolations(context, openPanel)
  await saveKey(panel, 'test-key-1234')
  expect(await serviceWorker.evaluate(() => chrome.storage.local.get(null))).toEqual({
    geminiApiKey: 'test-key-1234',
  })

  await panel.getByRole('button', { name: 'Explain button-name on #icon-button' }).click()
  const explanation = panel.locator('.explanation').first()
  await expect(explanation.locator('p')).toHaveText([
    'A button without text has no accessible name.',
    'Screen reader users hear only "button".',
  ])
  await expect(explanation.locator('pre')).toHaveText(
    '<button type="button" id="icon-button" aria-label="Close"></button>',
  )

  expect(requests).toHaveLength(1)
  expect(requests[0]!.url).toBe(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
  )
  expect(requests[0]!.key).toBe('test-key-1234')
  expect(requests[0]!.prompt).toContain('Rule: button-name')
  expect(requests[0]!.prompt).toContain('<button type="button" id="icon-button"></button>')

  // A new scan starts without old explanations.
  await panel.getByRole('button', { name: 'Scan again' }).click()
  await expect(panel.locator('.explanation p')).toHaveCount(0)
})

test('shows a Gemini error as a message', async ({ context, openPanel }) => {
  await context.route(GEMINI, (route) =>
    route.fulfill({
      status: 429,
      json: { error: { code: 429, message: 'Quota exceeded', status: 'RESOURCE_EXHAUSTED' } },
    }),
  )
  const { panel } = await scanViolations(context, openPanel)
  await saveKey(panel, 'test-key-1234')

  await panel.getByRole('button', { name: 'Explain image-alt on #swatch' }).click()
  await expect(panel.locator('.explanation').nth(1)).toHaveText(
    'The Gemini rate limit for this key is used up for now. Try again later.',
  )
})

test('removes the saved key', async ({ context, openPanel, serviceWorker }) => {
  const { panel } = await scanViolations(context, openPanel)
  await saveKey(panel, 'test-key-1234')

  await panel.getByRole('button', { name: 'Remove key' }).click()
  await expect(panel.locator('#api-key-hint')).toContainText('No key saved.')
  expect(await serviceWorker.evaluate(() => chrome.storage.local.get(null))).toEqual({})
})

test('keeps the API key out of reach of scripts injected into pages', async ({
  context,
  openPanel,
  serviceWorker,
}) => {
  const { panel } = await scanViolations(context, openPanel)
  await saveKey(panel, 'test-key-1234')

  const fromPage = await serviceWorker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: 'http://localhost:5180/*' })
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab!.id! },
      func: async () => {
        try {
          return JSON.stringify(await chrome.storage.local.get(null))
        } catch (error) {
          return `denied: ${(error as Error).message}`
        }
      },
    })
    return injection!.result
  })
  expect(fromPage).toMatch(/^denied/)
})
