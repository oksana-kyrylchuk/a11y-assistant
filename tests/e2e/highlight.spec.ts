import { expect, test } from './fixtures'

const OVERLAY = '#a11y-assistant-highlight'

test('highlights the selected element on the page', async ({ context, openPanel }) => {
  const page = await context.newPage()
  await page.goto('/violations.html')
  const panel = await openPanel(page)
  await panel.getByRole('button', { name: 'Scan page' }).click()
  await expect(panel.getByRole('status')).toContainText('9 issues')

  const element = panel.getByRole('button', { name: '#low-contrast', exact: true })
  await element.click()
  await expect(element).toHaveAttribute('aria-pressed', 'true')

  // The outline surrounds the element with a 4px gap on each side.
  const target = (await page.locator('#low-contrast').boundingBox())!
  const overlay = (await page.locator(OVERLAY).boundingBox())!
  expect(overlay.x).toBeCloseTo(target.x - 4, 0)
  expect(overlay.y).toBeCloseTo(target.y - 4, 0)
  expect(overlay.width).toBeCloseTo(target.width + 8, 0)
  expect(overlay.height).toBeCloseTo(target.height + 8, 0)

  // Selecting another element moves the single outline there, and an
  // element without size still gets a visible one.
  await panel.getByRole('button', { name: '#empty-link', exact: true }).click()
  await expect(element).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator(OVERLAY)).toHaveCount(1)
  const empty = (await page.locator(OVERLAY).boundingBox())!
  expect(empty.width).toBeGreaterThanOrEqual(16)
  expect(empty.height).toBeGreaterThanOrEqual(16)
})

test('says so when the element is no longer on the page', async ({ context, openPanel }) => {
  const page = await context.newPage()
  await page.goto('/violations.html')
  const panel = await openPanel(page)
  await panel.getByRole('button', { name: 'Scan page' }).click()
  await expect(panel.getByRole('status')).toContainText('9 issues')

  await page.locator('#search').evaluate((input) => input.remove())
  await panel.getByRole('button', { name: '#search', exact: true }).click()
  await expect(panel.getByRole('alert')).toHaveText(
    'This element is no longer on the page. Scan again to refresh the list.',
  )
})

test('the outline is not reported as an issue on the next scan', async ({ context, openPanel }) => {
  const page = await context.newPage()
  await page.goto('/violations.html')
  const panel = await openPanel(page)
  await panel.getByRole('button', { name: 'Scan page' }).click()
  await panel.getByRole('button', { name: '#icon-button', exact: true }).click()
  await expect(page.locator(OVERLAY)).toHaveCount(1)

  await panel.getByRole('button', { name: 'Scan again' }).click()
  await expect(panel.getByRole('status')).toContainText('9 issues on 9 elements')
  await expect(page.locator(OVERLAY)).toHaveCount(0)
})
