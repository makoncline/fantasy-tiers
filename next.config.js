/** @type {import('next').NextConfig} */
const path = require("path");

// TODO: Re-enable strict build checks once non-draft pages are fixed.
// - Remove typescript.ignoreBuildErrors and eslint.ignoreDuringBuilds
const nextConfig = {
  reactStrictMode: true,
  // Silence workspace root inference warnings by pinning tracing root
  outputFileTracingRoot: path.join(__dirname),
  // Build checks re-enabled
  async redirects() {
    return [];
  },
};

module.exports = nextConfig;
