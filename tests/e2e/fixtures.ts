import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  chromium,
  test as base,
  type Browser,
  type BrowserContext,
  type Page,
  type Worker,
} from '@playwright/test'

const EXTENSION_PATH = resolve(import.meta.dirname, '../../dist')

interface ExtensionFixtures {
  userDataDir: string
  context: BrowserContext
  serviceWorker: Worker
  /**
   * Clicks the extension icon for the tab showing `page`, as a user would,
   * and returns the side panel. The click is what grants activeTab.
   */
  openPanel: (page: Page) => Promise<Page>
}

export const test = base.extend<ExtensionFixtures>({
  // Playwright requires the destructured (empty) fixtures argument.
  // oxlint-disable-next-line no-empty-pattern
  userDataDir: async ({}, use) => {
    const dir = mkdtempSync(join(tmpdir(), 'a11y-assistant-'))
    await use(dir)
    rmSync(dir, { recursive: true, force: true })
  },

  // Extensions only load in a persistent context.
  context: async ({ userDataDir }, use) => {
    const executablePath = process.env.CHROMIUM_PATH
    const context = await chromium.launchPersistentContext(userDataDir, {
      // The bundled Chromium runs extensions headless; branded Chrome no
      // longer loads unpacked extensions from the command line.
      ...(executablePath ? { executablePath } : { channel: 'chromium' }),
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        // Allows the Extensions.triggerAction DevTools command.
        '--enable-unsafe-extension-debugging',
        // Chromium writes the chosen port to DevToolsActivePort.
        '--remote-debugging-port=0',
        ...(process.env.CHROMIUM_NO_SANDBOX ? ['--no-sandbox'] : []),
      ],
    })
    await use(context)
    await context.close()
  },

  serviceWorker: async ({ context }, use) => {
    const [existing] = context.serviceWorkers()
    await use(existing ?? (await context.waitForEvent('serviceworker')))
  },

  openPanel: async ({ serviceWorker, userDataDir }, use) => {
    const extensionId = new URL(serviceWorker.url()).host
    const [port] = readFileSync(join(userDataDir, 'DevToolsActivePort'), 'utf8').split('\n')
    const endpoint = `http://127.0.0.1:${port}`
    const panelUrl = `chrome-extension://${extensionId}/sidepanel.html`
    const connections: Browser[] = []

    async function connect() {
      const browser = await chromium.connectOverCDP(endpoint)
      connections.push(browser)
      return browser
    }

    await use(async (page) => {
      // Playwright has no API for the toolbar button, so send the DevTools
      // command over a browser-level session.
      const cdp = await (await connect()).newBrowserCDPSession()
      const { targetInfos } = await cdp.send('Target.getTargets', {
        filter: [{ type: 'tab' }],
      })
      const tabs = targetInfos.filter((target) => target.url === page.url())
      if (tabs.length !== 1) {
        throw new Error(`Expected one tab showing ${page.url()}, found ${tabs.length}`)
      }
      await cdp.send('Extensions.triggerAction', {
        id: extensionId,
        targetId: tabs[0]!.targetId,
      })

      // A connection only sees the pages that exist when it is made, and the
      // side panel opens after the click: reconnect until it shows up.
      for (let attempt = 0; attempt < 50; attempt++) {
        const panel = (await connect())
          .contexts()
          .flatMap((browserContext) => browserContext.pages())
          .find((candidate) => candidate.url() === panelUrl)
        if (panel) {
          await panel.waitForLoadState()
          return panel
        }
        await new Promise((done) => setTimeout(done, 100))
      }
      throw new Error('The side panel did not open')
    })

    for (const connection of connections) await connection.close()
  },
})

export { expect } from '@playwright/test'
