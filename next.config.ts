import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["read-excel-file"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      }
    ]
  },
  experimental: {
    optimizePackageImports: ["lucide-react"]
  }
};

export default nextConfig;
