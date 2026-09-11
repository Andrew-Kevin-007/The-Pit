/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@the-pit/shared", "@the-pit/graph-client"],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
