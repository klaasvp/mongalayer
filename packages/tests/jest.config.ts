import type { JestConfigWithTsJest } from 'ts-jest'

const jestConfig: JestConfigWithTsJest = {
    preset: "@shelf/jest-mongodb",
    extensionsToTreatAsEsm: [".ts"],
    transform: {
        '^.+\\.tsx?$': [ 'ts-jest', { useESM: true } ],
    },
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    }
}

export default jestConfig