import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

const src = (path: string): string =>
  fileURLToPath(new URL(`./src/${path}`, import.meta.url));

export default defineConfig({
  // '/' for Cloudflare Pages or a custom domain. Set VITE_BASE=/repo-name/ for a GitHub Pages project site.
  base: process.env["VITE_BASE"] ?? "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@app": src("app"),
      "@domain": src("domain"),
      "@application": src("application"),
      "@infrastructure": src("infrastructure"),
      "@presentation": src("presentation"),
      "@shared": src("shared"),
    },
  },
  build: {
    target: "es2022",
    sourcemap: false,
    // Never inline assets as data: URIs; the CSP only allows fonts from 'self'.
    assetsInlineLimit: 0,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/domain/**", "src/application/**"],
      exclude: ["**/*.test.*", "**/ports/**"],
      reporter: ["text", "html"],
    },
  },
});
