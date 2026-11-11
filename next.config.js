/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  experimental: {
    serverActions: {
      bodySizeLimit: "11mb",
    },
  },
};

module.exports = nextConfig;
