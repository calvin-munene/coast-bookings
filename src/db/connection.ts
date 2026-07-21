import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getDatabaseUrl, getEnv } from "@/lib/env";
import * as schema from "./schema";

let queryClient: ReturnType<typeof postgres> | undefined;

export function getDb() {
  const env = getEnv();
  const connectionString = getDatabaseUrl(env);
  const ssl = env.DATABASE_SSL === "require" ? "require" : env.DATABASE_SSL === "disable" ? false : undefined;
  queryClient ??= postgres(connectionString, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    ...(ssl === undefined ? {} : { ssl }),
  });
  return drizzle(queryClient, { schema });
}
