/**
 * Version 1 of the extraction contract.
 *
 * A version is a prompt and the schema that goes with it, frozen together: the
 * two only make sense as a pair, and a stored `promptVersion` has to identify
 * both. Changing either means a new version rather than an edit here, so rows
 * extracted last month stay explicable.
 */

export * from './job-extraction.prompt'
export * from './job-extraction.schema'
export * from './job-insights.prompt'
export * from './job-insights.schema'
export * from './job-match.prompt'
export * from './job-match.schema'
export * from './resume-extraction.prompt'
export * from './resume-extraction.schema'
