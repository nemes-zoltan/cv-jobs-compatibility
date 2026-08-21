const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin')
const { IgnorePlugin } = require('webpack')
const { join } = require('path')

/**
 * Optional NestJS integrations. Nest requires them lazily and degrades when they
 * are absent, but webpack still tries to resolve them and reports a failure.
 * Only the ones that are genuinely not installed are ignored, so adding e.g.
 * class-validator to this app's dependencies bundles it as normal.
 */
const OPTIONAL_NEST_INTEGRATIONS = [
  '@nestjs/microservices',
  '@nestjs/websockets',
  'class-transformer',
  'class-validator',
]

/**
 * These can never be part of a CommonJS bundle: `file-type` is ESM-only and
 * `FileTypeValidator` pulls it in through a runtime dynamic import anyway, and
 * `pg-native` is an optional native addon that `pg` probes for and lives
 * without. Ignoring them leaves both runtime paths intact.
 */
const NEVER_BUNDLED = ['file-type', 'pg-native']

const isInstalled = (packageName) => {
  try {
    require.resolve(packageName, { paths: [__dirname] })
    return true
  } catch {
    return false
  }
}

const ignoredModules = [...OPTIONAL_NEST_INTEGRATIONS.filter((name) => !isInstalled(name)), ...NEVER_BUNDLED]

module.exports = {
  output: {
    path: join(__dirname, 'dist'),
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  ignoreWarnings: [
    // Nest and Express look up optional adapters through a computed `require`,
    // which webpack cannot follow and warns about once per call site. The
    // lookups are wrapped in try/catch and resolve fine at runtime.
    /Critical dependency: the request of a dependency is an expression/,
    // Some published packages (iterare) point their source maps at .ts files
    // they do not ship. Nothing we can fix from here, and it says nothing about
    // this app's own sources.
    /Failed to parse source map/,
  ],
  plugins: [
    new IgnorePlugin({
      checkResource: (resource) =>
        ignoredModules.some((name) => resource === name || resource.startsWith(`${name}/`)),
    }),
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ["./src/assets"],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: false,
      sourceMap: true,
    })
  ],
}
