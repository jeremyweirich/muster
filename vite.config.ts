import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";

// Stamp the build with the commit count and short hash, shown next to "prototype" in the header.
function git(cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}
const count = git("rev-list --count HEAD");
const hash = git("rev-parse --short HEAD");

export default defineConfig({
  plugins: [react()],
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(count ? `v${count} · ${hash}` : "dev"),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
});
