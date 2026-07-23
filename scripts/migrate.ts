import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { getDatabaseUrl } from "../src/lib/env";

const connectionString = getDatabaseUrl();

const client = postgres(connectionString, { max: 1 });
try {
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  console.log("Migrations complete.");
} finally {
  await client.end();
}
