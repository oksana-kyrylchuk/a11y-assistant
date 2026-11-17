import { expect, test } from './fixtures'

test('keeps results for an anchor and clears them after following a link', async ({
  context,
  openPanel,
}) => {
  const page = await context.newPage()
  await page.goto('/violations.html')
  const panel = await openPanel(page)
  await panel.getByRole('button', { name: 'Scan page' }).click()
  await expect(panel.getByRole('status')).toContainText('9 issues')

  await page.evaluate(() => {
    location.hash = 'details'
  })
  await page.waitForTimeout(500)
  await expect(panel.getByRole('status')).toContainText('9 issues')

  await page.getByRole('link', { name: 'Go to the page without violations' }).click()
  await expect(panel.getByRole('status')).toHaveText('Results cleared: the page has changed.')
  await expect(panel.locator('section')).toHaveCount(0)
})

test('clears results after a reload', async ({ context, openPanel }) => {
  const page = await context.newPage()
  await page.goto('/violations.html')
  const panel = await openPanel(page)
  await panel.getByRole('button', { name: 'Scan page' }).click()
  await expect(panel.getByRole('status')).toContainText('9 issues')

  await page.reload()
  await expect(panel.getByRole('status')).toHaveText('Results cleared: the page has changed.')
})

test('clears results when another tab is activated', async ({ context, openPanel }) => {
  const page = await context.newPage()
  await page.goto('/violations.html')
  const panel = await openPanel(page)
  await panel.getByRole('button', { name: 'Scan page' }).click()
  await panel.getByRole('button', { name: '#swatch', exact: true }).click()
  await expect(page.locator('#a11y-assistant-highlight')).toHaveCount(1)

  const other = await context.newPage()
  await other.goto('/clean.html')
  await other.bringToFront()
  await expect(panel.getByRole('status')).toHaveText(
    'Results cleared: you switched to another tab.',
  )
  // The outline is removed from the tab that was scanned.
  await expect(page.locator('#a11y-assistant-highlight')).toHaveCount(0)
})
