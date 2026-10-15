import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer", "mammoth", "unpdf"],
  // Font PDF dibaca dari disk saat runtime; pastikan ikut ter-bundle di serverless.
  outputFileTracingIncludes: {
    "/api/unduh/*": ["./assets/fonts/**", "./public/logo-nawasena*.png"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
