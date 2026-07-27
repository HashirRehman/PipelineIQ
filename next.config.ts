import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev is accessed via 127.0.0.1 (matches NEXT_PUBLIC_SITE_URL / Supabase
  // site_url), which Next.js's dev-origin protection blocks by default —
  // without this, the client JS bundle itself can fail to load under that
  // host, so "use client" pages silently never hydrate.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
