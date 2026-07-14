import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // Vitest's default include glob picks up **/*.test.ts anywhere in the
    // project, including supabase/functions/**/*.test.ts — those are Deno
    // tests (Deno.test, remote https: imports), meant for `deno test`, not
    // vitest. Scope vitest to src/ so it doesn't try (and fail) to run them.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
}));
