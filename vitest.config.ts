import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@everaft/planning-domain/budget/payment-schedule": fileURLToPath(
        new URL("./packages/planning-domain/src/budget/payment-schedule.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    exclude: ["apps/mobile/**", "node_modules/**"],
    maxWorkers: 2,
  },
});
