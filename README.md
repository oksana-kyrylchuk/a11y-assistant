# Accessibility Assistant

A browser extension (Manifest V3) for Chrome and Opera: a side panel that checks the open page for accessibility issues and explains how to fix them.

Work in progress.

## Run locally

Requires Node 22.

```sh
npm install
npm run build
```

Then load the `dist` folder as an unpacked extension:

- Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked**
- Opera: `opera://extensions` → enable **Developer mode** → **Load unpacked**

Click the extension icon in the toolbar to open the side panel.

`npm run dev` rebuilds `dist` on every change; reload the extension on the extensions page to pick it up.

## Explain (optional)

Each reported element has an **Explain** button that asks Google Gemini why the issue matters and how to fix it. It needs your own API key from [Google AI Studio](https://aistudio.google.com/): open **Settings** at the bottom of the panel and paste it there. Scanning and highlighting work without a key.

- The key is stored in `chrome.storage.local` in your browser and is only sent to `generativelanguage.googleapis.com`.
- Explaining an issue sends the rule and the HTML of that element to Google. On the free tier Google may use this content to improve its products.

## Tests

```sh
npm test            # unit tests (Vitest)
npm run test:e2e    # builds the extension and runs the Playwright tests
```

The end-to-end tests load the built extension into Chromium, click its toolbar icon through the `Extensions.triggerAction` DevTools command (that click is what grants `activeTab`), and drive the side panel against the pages in `test-pages`. Gemini responses are mocked with `context.route`, so no API key is needed. Install the browser once with `npx playwright install chromium`.

CI runs lint, type checks, unit and end-to-end tests on every push to `main`.
