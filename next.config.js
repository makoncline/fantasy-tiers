/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  reactStrictMode: true,
  // Silence workspace root inference warnings by pinning tracing root
  outputFileTracingRoot: path.join(__dirname),
  async redirects() {
    return [];
  },
};

module.exports = nextConfig;
