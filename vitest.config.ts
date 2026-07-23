import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.{ts,tsx}"], environment: "node", coverage: { provider: "v8", reporter: ["text", "html"] } },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
