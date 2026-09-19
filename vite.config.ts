import { defineConfig } from 'vite'
import logseqPlugin from 'vite-plugin-logseq'

export default defineConfig({
  plugins: [logseqPlugin()],
  build: {
    target: 'esnext',
    // `true` uses Vite 8's own minifier. Naming esbuild here fails: Vite 8
    // bundles rolldown/oxc instead and esbuild is no longer installed.
    minify: true,
    // Kept: a plugin fails inside someone else's app, and a stack trace into
    // minified code is not worth debugging.
    sourcemap: true,
  },
})
