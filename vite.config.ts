import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
