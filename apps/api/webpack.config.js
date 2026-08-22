const createConfig = require('./webpack.base')

/** The HTTP server. */
module.exports = createConfig({ main: './src/main.ts', outputPath: 'dist' })
