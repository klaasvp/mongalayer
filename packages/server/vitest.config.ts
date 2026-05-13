import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        globalSetup: `./__tests__/setup.ts`,
        // As we're using a shared mongoserver instance, we can't run tests in parallel
        isolate: false,
        fileParallelism: false,
        typecheck: {
            enabled: true
        }
    },
})