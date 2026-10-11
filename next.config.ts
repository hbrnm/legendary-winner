import type { NextConfig } from "next";

// Aplicația e statică (static export): datele stau în IndexedDB pe dispozitiv
// și se sincronizează direct cu Supabase. Vezi ARCHITECTURE.md.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
