import path from "node:path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // The repo root also carries a package-lock.json, so Next infers the wrong
  // workspace root and traces the wrong tree. This app is self-contained.
  turbopack: {
    root: path.join(__dirname),
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
}

export default nextConfig
