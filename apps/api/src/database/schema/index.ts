/**
 * Drizzle schema barrel.
 *
 * Tables live in sibling files and are re-exported from here; both the runtime
 * client (`drizzle(pool, { schema })`) and `drizzle-kit` read this one module.
 */

export * from './users'
