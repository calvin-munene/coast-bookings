import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const provider = process.env.DATABASE_PROVIDER ?? "replit";
const databaseUrl = provider === "supabase" ? process.env.SUPABASE_DATABASE_URL : process.env.DATABASE_URL;
if (!databaseUrl) throw new Error(`${provider === "supabase" ? "SUPABASE_DATABASE_URL" : "DATABASE_URL"} is required for Drizzle commands`);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: databaseUrl },
  strict: true,
  verbose: true,
});
