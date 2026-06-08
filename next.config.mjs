/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep production builds resilient on low-memory devices: don't fail the
  // build on lint issues (type-checking still runs).
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
