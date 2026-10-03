import { defineConfig } from "vitest/config";

// Only the Firestore-rules tests; run through `npm run test:rules`
// (firebase emulators:exec provides FIRESTORE_EMULATOR_HOST).
export default defineConfig({
  test: { environment: "node", include: ["rules-tests/**/*.test.ts"], fileParallelism: false },
});
