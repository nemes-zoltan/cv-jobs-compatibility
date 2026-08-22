const createConfig = require('./webpack.base')

/**
 * The queue worker. Its own output directory because both builds clean theirs,
 * and they would otherwise delete each other.
 */
module.exports = createConfig({ main: './src/worker.ts', outputPath: 'dist-worker' })
