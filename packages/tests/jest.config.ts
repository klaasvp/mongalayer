import type { JestConfigWithTsJest } from 'ts-jest'

const jestConfig: JestConfigWithTsJest = {
    extensionsToTreatAsEsm: [".ts"],
    transform: {
        '^.+\\.tsx?$': [ 'ts-jest', { useESM: true } ],
    },
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    globalSetup: "./global/setup.ts",
    globalTeardown: "./global/teardown.ts"
}

export default jestConfig