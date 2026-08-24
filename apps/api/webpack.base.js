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
 * without. `bufferutil` and `utf-8-validate` are the same story for `ws`, which
 * arrives with OpenTelemetry's auto-instrumentations - both are speed-ups it
 * probes for behind a try/catch. Ignoring them leaves every runtime path intact.
 */
const NEVER_BUNDLED = ['file-type', 'pg-native', 'bufferutil', 'utf-8-validate']

const isInstalled = (packageName) => {
  try {
    require.resolve(packageName, { paths: [__dirname] })
    return true
  } catch {
    return false
  }
}

const ignoredModules = [...OPTIONAL_NEST_INTEGRATIONS.filter((name) => !isInstalled(name)), ...NEVER_BUNDLED]

/**
 * Shared by all three entrypoints. The HTTP server, the queue worker and the
 * migration task are built from the same sources into separate bundles, so one
 * image can run any of them - see DECISIONS.md.
 */
module.exports = function createConfig({ main, outputPath, assets = [] }) {
  return {
  output: {
    path: join(__dirname, outputPath),
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
    // OpenTelemetry's auto-instrumentations reach for every library they know
    // how to patch, most of which this app does not have, and patch modules
    // through a computed require that webpack cannot follow. Both are expected.
    /Can't resolve '@opentelemetry\/winston-transport'/,
    /Critical dependency: require function is used/,
  ],
  plugins: [
    new IgnorePlugin({
      checkResource: (resource) =>
        ignoredModules.some((name) => resource === name || resource.startsWith(`${name}/`)),
    }),
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main,
      tsConfig: './tsconfig.app.json',
      /**
       * `argon2` loads a compiled `.node` binding by looking for a `prebuilds`
       * directory next to its own source. Bundling it rewrites that lookup to
       * the output directory, where no such directory exists, and the module
       * throws on load. Leaving it external keeps the plain `require('argon2')`
       * so it resolves from node_modules at runtime - which is what the
       * `prune-lockfile` and `copy-workspace-modules` targets exist to provide.
       */
      externalDependencies: ['argon2'],
      assets: ["./src/assets", ...assets],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: false,
      sourceMap: true,
    })
  ],
  }
}
