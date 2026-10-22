import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Image autonome pour le conteneur Aiven Runtime.
  output: "standalone",
  // PGlite charge ses fichiers WASM à l'exécution : on ne le bundle pas.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
};

export default nextConfig;
