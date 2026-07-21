import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

let queryClient: ReturnType<typeof postgres> | undefined;

export function getDb() {
  const connectionString = getEnv().DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for persistent operations");
  queryClient ??= postgres(connectionString, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: "require",
  });
  return drizzle(queryClient, { schema });
}
