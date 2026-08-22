/**
 * Domain constants shared across the workspace.
 *
 * Values that exist at runtime and that more than one package has to agree on:
 * enum members the database also declares, limits both the browser and the API
 * check, names that cross a boundary. Anything erased at compile time belongs
 * in `@cv-jobs-compatibility/types` instead.
 *
 * Everything here is a frozen literal, so a consumer can derive a union from it
 * as well as read it.
 */

export * from './cookies'
export * from './resumes'
export * from './skills'
