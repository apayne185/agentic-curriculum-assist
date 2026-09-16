import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright (used for PDF export) loads pages from this same server over
  // loopback, which dev's cross-origin protection would otherwise flag.
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  // pdf-parse (via pdfjs-dist) loads its worker script as a runtime file
  // path; bundling it breaks that resolution, so let Node require() it
  // natively instead.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
