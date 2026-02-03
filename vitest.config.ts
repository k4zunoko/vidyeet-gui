import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [
      'src/**/*.{test,spec}.ts',
      'src/**/__tests__/**/*.ts',
      'electron/**/*.{test,spec}.ts',
      'electron/**/__tests__/**/*.ts',
    ],
  },
})
