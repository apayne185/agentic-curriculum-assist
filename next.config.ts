import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright (used for PDF export) loads pages from this same server over
  // loopback, which dev's cross-origin protection would otherwise flag.
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  // pdf-parse (via pdfjs-dist) loads its worker script as a runtime file
  // path; bundling it breaks that resolution, so let Node require() it
  // natively instead. @sparticuz/chromium (used only on Vercel, see
  // lib/pdf-render.ts) ships a large Brotli-compressed binary that
  // similarly shouldn't be processed by the bundler — it's unpacked into
  // /tmp at runtime by the package itself.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@sparticuz/chromium"],
  // Next.js's file tracing only follows static imports/requires, so it
  // wouldn't otherwise notice @sparticuz/chromium's binary payload behind
  // the dynamic import in lib/pdf-render.ts — without this, the deployed
  // function is missing the very binary it tries to launch.
  outputFileTracingIncludes: {
    "app/api/export-pdf/route.ts": ["./node_modules/@sparticuz/chromium/**"],
  },
};

export default nextConfig;
