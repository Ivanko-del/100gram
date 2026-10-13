import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // rules-tests/ need the Firestore emulator - run them via `npm run test:rules`
    exclude: [...configDefaults.exclude, "rules-tests/**"],
  },
});
