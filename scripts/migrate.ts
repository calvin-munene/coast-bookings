import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { getDatabaseUrl, getEnv } from "../src/lib/env";

const env = getEnv();
const connectionString = getDatabaseUrl(env);
const ssl = env.DATABASE_SSL === "require" ? "require" : env.DATABASE_SSL === "disable" ? false : undefined;

const client = postgres(connectionString, { max: 1, ...(ssl === undefined ? {} : { ssl }) });
try {
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
} finally {
  await client.end();
}
