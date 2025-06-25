import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Add support for importing .proto files as raw text
    config.module.rules.push({
      test: /\.proto$/,
      type: 'asset/source',
    });
    
    return config;
  },
}

export default nextConfig;
