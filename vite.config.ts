import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const require = createRequire(import.meta.url)

// axe-core is injected into the page with chrome.scripting.executeScript,
// which needs a plain script file inside the extension, not a bundled module.
function copyAxe(): Plugin {
  return {
    name: 'copy-axe',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'axe.min.js',
        source: readFileSync(require.resolve('axe-core/axe.min.js')),
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), copyAxe()],
  build: {
    rollupOptions: {
      input: {
        sidepanel: 'sidepanel.html',
        'service-worker': 'src/background/service-worker.ts',
      },
      output: {
        // manifest.json points at the service worker by name, so no hash.
        entryFileNames: (chunk) =>
          chunk.name === 'service-worker'
            ? 'service-worker.js'
            : 'assets/[name]-[hash].js',
      },
    },
  },
})
