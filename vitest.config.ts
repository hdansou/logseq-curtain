import { defineConfig } from 'vitest/config'

// Deliberately does NOT load vite-plugin-logseq: that plugin expects a real
// Logseq host at buildStart and fails under the test runner.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
})
