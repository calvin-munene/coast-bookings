import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

// Use DATABASE_URL only if it's a real Postgres connection string.
// Falls back to PG* env vars (Replit built-in database).
const raw = process.env.DATABASE_URL;
const connectionString = raw?.startsWith("postgresql://") ? raw : undefined;

const client = connectionString
  ? postgres(connectionString, { max: 1 })
  : postgres({
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT ?? 5432),
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
      max: 1,
    });

try {
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  console.log("Migrations complete.");
} finally {
  await client.end();
}
