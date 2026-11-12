import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  experimental: {
    allowedDevOrigins: ["macbook-pro-de-joao-1.tailf17159.ts.net", "100.79.40.97"],
  },
};

export default nextConfig;
