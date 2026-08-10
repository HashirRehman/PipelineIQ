import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev is accessed via 127.0.0.1 (matches NEXT_PUBLIC_SITE_URL / Supabase
  // site_url), which Next.js's dev-origin protection blocks by default —
  // without this, the client JS bundle itself can fail to load under that
  // host, so "use client" pages silently never hydrate.
  allowedDevOrigins: ["127.0.0.1"],

  // CV text extraction (lib/cv-parsing/extract-text.ts) uses two CJS,
  // Node-only libraries. pdf-parse ships its own pdf.js builds and resolves
  // one at runtime — bundling it pulls in every copy and breaks the runtime
  // require, so both are kept external and loaded as real Node modules.
  serverExternalPackages: ["pdf-parse", "mammoth"],
};

export default nextConfig;
