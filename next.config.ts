import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployments when NEXT_BUILD_STANDALONE=1
  // This creates a minimal bundle with only runtime dependencies
  ...(process.env.NEXT_BUILD_STANDALONE === '1' && { output: 'standalone' }),

  // Set the root directory for Turbopack to silence lockfile warning
  turbopack: {
    root: __dirname,
  },
  webpack: config => {
    // Add support for importing .proto files as raw text
    config.module.rules.push({
      test: /\.proto$/,
      type: 'asset/source',
    })

    return config
  },
}

export default nextConfig
