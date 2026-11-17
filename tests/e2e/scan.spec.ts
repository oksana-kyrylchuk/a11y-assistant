import { expect, test } from './fixtures'

// The expected result for test-pages/violations.html, as listed in
// test-pages/README.md.
const EXPECTED = {
  Critical: [
    ['button-name', '#icon-button'],
    ['image-alt', '#swatch'],
    ['label', '#search'],
  ],
  Serious: [
    ['color-contrast', '#low-contrast'],
    ['html-has-lang', 'html'],
    ['link-name', '#empty-link'],
  ],
  Moderate: [
    ['heading-order', '#skipped-level'],
    ['region', '#outside-landmark'],
  ],
  Minor: [['empty-heading', '#empty-heading']],
}

test('lists the known violations grouped by severity', async ({ context, openPanel }) => {
  const page = await context.newPage()
  await page.goto('/violations.html')
  const panel = await openPanel(page)

  await panel.getByRole('button', { name: 'Scan page' }).click()
  await expect(panel.getByRole('status')).toContainText('9 issues on 9 elements')

  const sections = panel.locator('section')
  await expect(sections.getByRole('heading', { level: 2 })).toHaveText(
    Object.entries(EXPECTED).map(([severity, rules]) => `${severity} (${rules.length})`),
  )
  for (const [index, rules] of Object.values(EXPECTED).entries()) {
    const section = sections.nth(index)
    await expect(section.locator('.rule a')).toHaveText(rules.map(([rule]) => rule!))
    await expect(section.locator('.node code')).toHaveText(rules.map(([, element]) => element!))
  }
})

test('reports no issues on a page without violations', async ({ context, openPanel }) => {
  const page = await context.newPage()
  await page.goto('/clean.html')
  const panel = await openPanel(page)

  await panel.getByRole('button', { name: 'Scan page' }).click()
  await expect(panel.getByRole('status')).toHaveText(
    'No issues found on “No accessibility violations”.',
  )
  await expect(panel.locator('section')).toHaveCount(0)
})

test('needs the icon click on a tab before it can scan it', async ({ context, openPanel }) => {
  const first = await context.newPage()
  await first.goto('/violations.html')
  const panel = await openPanel(first)

  const second = await context.newPage()
  await second.goto('/clean.html')
  await second.bringToFront()
  await panel.getByRole('button', { name: 'Scan page' }).click()
  await expect(panel.getByRole('alert')).toContainText('No access to this tab')

  await openPanel(second)
  await panel.getByRole('button', { name: 'Scan page' }).click()
  await expect(panel.getByRole('status')).toContainText('No issues found')
})
