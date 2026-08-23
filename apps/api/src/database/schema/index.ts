/**
 * Drizzle schema barrel.
 *
 * Tables live in sibling files and are re-exported from here; both the runtime
 * client (`drizzle(pool, { schema })`) and `drizzle-kit` read this one module.
 */

export * from './job-extractions'
export * from './job-insights'
export * from './job-matches'
export * from './job-sections'
export * from './job-texts'
export * from './jobs'
export * from './resume-extractions'
export * from './resume-ingestions'
export * from './resume-sections'
export * from './resume-texts'
export * from './resumes'
export * from './saved-jobs'
export * from './users'
