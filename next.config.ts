import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Next.js 16 requires an explicit qualities allow-list. Keep the default
    // 75 so existing <Image> usages still work, and add 90/95 for mentor
    // photos that need to look crisp.
    qualities: [75, 90, 95],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "dzprwmzbahkpwwyympko.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
