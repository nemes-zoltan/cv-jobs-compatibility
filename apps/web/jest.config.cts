const nextJest = require('next/jest.js')

const createJestConfig = nextJest({
  dir: './',
})

const config = {
  displayName: '@cv-jobs-compatibility/web',
  preset: '../../jest.preset.js',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  // The `@/*` alias is declared in this project's tsconfig rather than in
  // tsconfig.base.json, which is the only one Nx's jest resolver reads.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  coverageDirectory: '../../coverage/apps/web',
  testEnvironment: 'jsdom',
}

const jestConfig = createJestConfig(config)

module.exports = async () => {
  const resolved = await jestConfig()
  // Disable SWC path alias resolution — handled by Nx jest resolver.
  for (const value of Object.values(resolved.transform)) {
    if (Array.isArray(value) && value[1]?.resolvedBaseUrl) {
      value[1] = { ...value[1], resolvedBaseUrl: undefined }
    }
  }
  return resolved
}
