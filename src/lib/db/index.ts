/**
 * Database module index
 *
 * Re-exports the database client and schema so callers can use:
 *   import { db, developers, issues } from "@/lib/db";
 */

export { db } from "./client";
export * from "./schema";
