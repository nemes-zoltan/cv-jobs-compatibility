const createConfig = require('./webpack.base')

/**
 * The migration task.
 *
 * The only bundle that carries assets of its own: the SQL files and their
 * journal are data, not code, so webpack would otherwise leave them behind and
 * the task would start, find nothing to apply, and report success.
 */
module.exports = createConfig({
  main: './src/migrate.ts',
  outputPath: 'dist-migrate',
  // `input` is resolved from the workspace root, unlike the project-relative
  // string form used for `src/assets`.
  assets: [{ input: 'apps/api/src/database/migrations', output: 'migrations', glob: '**/*' }],
})
