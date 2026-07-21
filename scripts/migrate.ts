import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const client = postgres(connectionString, { max: 1, ssl: "require" });
try {
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
} finally {
  await client.end();
}
