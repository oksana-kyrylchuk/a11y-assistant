import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

const ANSWER =
  'A button without text has no accessible name.\n\n```html\n<button aria-label="Close"></button>\n```'

/** Puts the panel into its fullest state: results, a selection, an explanation, open settings. */
async function fillPanel(panel: Page) {
  await panel.getByRole('button', { name: 'Scan page' }).click()
  await expect(panel.getByRole('status')).toContainText('9 issues')
  await panel.getByRole('button', { name: '#icon-button', exact: true }).click()
  await panel.getByText('Settings', { exact: true }).click()
  await panel.getByLabel('Gemini API key').fill('test-key-1234')
  await panel.getByRole('button', { name: 'Save' }).click()
  await panel.getByRole('button', { name: 'Explain button-name on #icon-button' }).click()
  await expect(panel.locator('.explanation pre')).toBeVisible()
  // An error message as well.
  await panel.getByRole('button', { name: 'Explain image-alt on #swatch' }).click()
  await expect(panel.locator('.explanation .error')).toBeVisible()
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`the panel itself has no axe violations (${colorScheme})`, async ({
    context,
    openPanel,
  }) => {
    let calls = 0
    await context.route('https://generativelanguage.googleapis.com/**', (route) =>
      ++calls === 1
        ? route.fulfill({ json: { candidates: [{ content: { parts: [{ text: ANSWER }] } }] } })
        : route.fulfill({ status: 429, json: { error: { code: 429 } } }),
    )
    const page = await context.newPage()
    await page.goto('/violations.html')
    const panel = await openPanel(page)
    await panel.emulateMedia({ colorScheme })

    // Empty state first, then everything shown at once.
    expect((await new AxeBuilder({ page: panel }).analyze()).violations).toEqual([])
    await fillPanel(panel)
    const { violations } = await new AxeBuilder({ page: panel }).analyze()
    expect(violations.map(({ id, nodes }) => ({ id, targets: nodes.map((n) => n.target) }))).toEqual([])
  })
}

test('the panel works with the keyboard alone', async ({ context, openPanel }) => {
  const page = await context.newPage()
  await page.goto('/violations.html')
  const panel = await openPanel(page)

  await panel.keyboard.press('Tab')
  await expect(panel.getByRole('button', { name: 'Scan page' })).toBeFocused()
  await panel.keyboard.press('Enter')
  await expect(panel.getByRole('status')).toContainText('9 issues')

  // Focus stays on the button after the scan, so the list follows it.
  await expect(panel.getByRole('button', { name: 'Scan again' })).toBeFocused()
  await panel.keyboard.press('Tab')
  await expect(panel.getByRole('link', { name: 'button-name' })).toBeFocused()
  await panel.keyboard.press('Tab')
  const element = panel.getByRole('button', { name: '#icon-button', exact: true })
  await expect(element).toBeFocused()
  await panel.keyboard.press('Space')
  await expect(element).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#a11y-assistant-highlight')).toHaveCount(1)

  // Every focused control shows a visible focus indicator.
  const outline = await element.evaluate((node) => getComputedStyle(node).outlineStyle)
  expect(outline).not.toBe('none')
})

test('the panel fits a narrow width without scrolling sideways', async ({
  context,
  openPanel,
}) => {
  const page = await context.newPage()
  await page.goto('/violations.html')
  const panel = await openPanel(page)
  await panel.setViewportSize({ width: 320, height: 600 })
  await panel.getByRole('button', { name: 'Scan page' }).click()
  await expect(panel.getByRole('status')).toContainText('9 issues')
  await panel.getByText('Settings', { exact: true }).click()

  const overflow = await panel.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBe(0)
})
