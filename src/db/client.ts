import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

let queryClient: ReturnType<typeof postgres> | undefined;

function getConnectionString(): string | undefined {
  const url = getEnv().DATABASE_URL;
  // Ignore DATABASE_URL if it's an HTTPS URL (Supabase REST endpoint, not a Postgres connection string)
  if (url && url.startsWith("postgresql://")) return url;
  // Fall back to individual PG* env vars (Replit built-in database)
  const { PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE } = process.env;
  if (PGHOST && PGUSER && PGDATABASE) {
    return `postgresql://${PGUSER}:${PGPASSWORD ?? ""}@${PGHOST}:${PGPORT ?? 5432}/${PGDATABASE}`;
  }
  return undefined;
}

export function getDb() {
  const connectionString = getConnectionString();
  if (!connectionString) throw new Error("No database connection available. Set DATABASE_URL or PG* env vars.");
  queryClient ??= postgres(connectionString, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return drizzle(queryClient, { schema });
}
