//@ts-check

const { join } = require('node:path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Emits `.next/standalone` - a server and only the files it actually reaches.
   * Without it an image has to carry the whole of `node_modules`, most of which
   * is build tooling that never runs.
   */
  output: 'standalone',
  /**
   * File tracing has to start at the repository root, not at this app.
   *
   * This is a pnpm workspace, so `@cv-jobs-compatibility/components` and its
   * siblings are symlinks pointing outside `apps/web`. Traced from here, Next
   * follows them out of its own root, gives up, and produces a server that
   * cannot start.
   */
  outputFileTracingRoot: join(__dirname, '../..'),
}

module.exports = nextConfig
