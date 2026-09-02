import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sites } from '@openai/sites-vite-plugin'
import { mkdir, writeFile } from 'node:fs/promises'
import process from 'node:process'

function staticSiteWorker() {
  return {
    name: 'signal-lab-static-worker',
    apply: 'build',
    async closeBundle() {
      const serverDirectory = new URL('./dist/server/', import.meta.url)
      await mkdir(serverDirectory, { recursive: true })
      await writeFile(
        new URL('index.js', serverDirectory),
        `export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const assetUrl = new URL(url.pathname === '/' ? '/index.html' : url.pathname, url)
    const assetResponse = await env.ASSETS.fetch(new Request(assetUrl, request))

    if (assetResponse.status !== 404 || request.method !== 'GET') {
      return assetResponse
    }

    return env.ASSETS.fetch(new Request(new URL('/index.html', url), request))
  }
}
`,
      )
    },
  }
}

export default defineConfig({
  base: process.env.SITES_BUILD === '1' ? '/' : '/sampling-analogue/',
  plugins: [react(), sites(), staticSiteWorker()],
})
