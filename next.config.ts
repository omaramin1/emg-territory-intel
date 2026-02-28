import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow JSON imports from data directory
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
