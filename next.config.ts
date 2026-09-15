import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright (used for PDF export) loads pages from this same server over
  // loopback, which dev's cross-origin protection would otherwise flag.
  allowedDevOrigins: ["localhost", "127.0.0.1"],
};

export default nextConfig;
