/** @type {import('next').NextConfig} */
const path = require("path");

// TODO: Re-enable strict build checks once non-draft pages are fixed.
// - Remove typescript.ignoreBuildErrors and eslint.ignoreDuringBuilds
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: { "/api/draft/*": ["./public/data/aggregate/fantasypros-draft-projections.json"] },
  // Silence workspace root inference warnings by pinning tracing root
  outputFileTracingRoot: path.join(__dirname),
  async rewrites() {
    return [{ source: "/espn-backup", destination: "/espn-backup.html" }];
  },
  // Build checks re-enabled
  async redirects() {
    return [];
  },
};

module.exports = nextConfig;
