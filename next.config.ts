import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  outputFileTracingIncludes: {
    "/api/store/contracts/\\[id\\]/pdf": [
      "./node_modules/@sparticuz/chromium/bin/**/*",
    ],
    "/api/sign/contracts/\\[token\\]/pdf": [
      "./node_modules/@sparticuz/chromium/bin/**/*",
    ],
    "/api/public/checkin/\\[token\\]/contracts/\\[contractId\\]/pdf": [
      "./node_modules/@sparticuz/chromium/bin/**/*",
    ],
  },
};

export default nextConfig;
