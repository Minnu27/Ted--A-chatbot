/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Keeps Vercel builds from failing when ESLint config is absent.
    ignoreDuringBuilds: true
  }
};

export default nextConfig;
