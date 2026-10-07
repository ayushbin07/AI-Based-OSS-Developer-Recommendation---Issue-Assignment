/**
 * Drizzle ORM Database Client
 *
 * Creates and exports a singleton Drizzle database instance.
 * Uses the `postgres` driver (node-postgres compatible).
 *
 * Required env vars:
 *   DATABASE_URL – PostgreSQL connection string
 *   e.g. postgresql://user:password@localhost:5432/ai_dev_recommender
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Singleton: reuse the connection in long-running server processes.
// Next.js HMR can cause module re-evaluation, so we attach to globalThis.
const globalForDb = globalThis as unknown as {
  _dbClient: ReturnType<typeof postgres> | undefined;
};

function createClient() {
  const connectionString =
    process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/ai_dev_recommender";
  return postgres(connectionString, {
    max: 10, // connection pool size
  });
}

const client =
  globalForDb._dbClient ?? (globalForDb._dbClient = createClient());

export const db = drizzle(client, { schema });

export type Database = typeof db;
