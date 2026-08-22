/**
 * Version 1 of the extraction contract.
 *
 * A version is a prompt and the schema that goes with it, frozen together: the
 * two only make sense as a pair, and a stored `promptVersion` has to identify
 * both. Changing either means a new version rather than an edit here, so rows
 * extracted last month stay explicable.
 */

export * from './resume-extraction.prompt'
export * from './resume-extraction.schema'
