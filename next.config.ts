import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow phone access on local network
  allowedDevOrigins: ['192.168.0.109'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
