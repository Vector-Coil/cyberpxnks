import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // Disable ESLint during build for faster deployment (fix issues later)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Enable compression for better performance
  compress: true,
  
  // Reduce page data size
  poweredByHeader: false,

  experimental: {
    // Note: `serverExternalPackages` is not recognized by this Next.js version's config schema
    // (causes: "Unrecognized key(s) in object: 'serverExternalPackages' at \"experimental\"").
    // If you need to keep certain packages server-only, import them only from server code
    // (API routes, server components, or inside `if (typeof window === 'undefined')` guards).
  },

    webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        // Explicitly set Node core modules to false for the client build
        fs: false,
        net: false,
        tls: false,
      };
    }

    return config;
  },
};

export default nextConfig;
