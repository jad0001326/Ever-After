import type { NextConfig } from "next";

const supabaseImagePattern = (() => {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!configuredUrl) return null;

  try {
    const url = new URL(configuredUrl);

    if (url.protocol !== "https:") return null;

    return {
      protocol: "https" as const,
      hostname: url.hostname,
      pathname: "/storage/v1/object/public/**"
    };
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  serverExternalPackages: ["read-excel-file"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      },
      ...(supabaseImagePattern ? [supabaseImagePattern] : [])
    ]
  },
  experimental: {
    optimizePackageImports: ["lucide-react"]
  }
};

export default nextConfig;
