import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev is accessed via 127.0.0.1 (matches NEXT_PUBLIC_SITE_URL / Supabase
  // site_url), which Next.js's dev-origin protection blocks by default —
  // without this, the client JS bundle itself can fail to load under that
  // host, so "use client" pages silently never hydrate.
  allowedDevOrigins: ["127.0.0.1"],

  // mammoth (DOCX text extraction, lib/cv-parsing/extract-text.ts) is CJS and
  // Node-only, so it stays a real Node require instead of being bundled.
  // The PDF side (unpdf) is pure JS and bundles cleanly, so it is not listed:
  // its predecessor pdf-parse had to be external, and being external is part
  // of why its native canvas dependency failed to resolve when deployed.
  serverExternalPackages: ["mammoth"],
};

export default nextConfig;
