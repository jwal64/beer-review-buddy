// The GitHub Pages build — used only by .github/workflows/pages.yml, never by
// Lovable, which keeps building from vite.config.ts.
//
// Pages serves static files from a subpath (/beer-review-buddy/), so this is
// the same app with two differences: SPA mode, which writes a static shell
// (_shell.html) instead of needing a server, and `base` set from PAGES_BASE.
// The app reads the log from a bundled snapshot and makes no data request, so
// a static shell is the whole of it. The few hard-coded paths in src/ go
// through import.meta.env.BASE_URL, which is "/" in Lovable's build.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    spa: { enabled: true },
  },
  vite: { base: process.env.PAGES_BASE ?? "/" },
});
