import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'fluent-ffmpeg',
    '@ffmpeg-installer/ffmpeg',
    'remotion',
    '@remotion/renderer',
    '@remotion/lambda',
    '@remotion/player',
    '@remotion/media-utils',
    '@remotion/gif',
    '@remotion/noise',
    '@remotion/shapes',
    '@remotion/transitions',
    'jsdom',
    '@mozilla/readability',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'oaidalleapiprodscus.blob.core.windows.net',
      },
      {
        protocol: 'https',
        hostname: 'remotionlambda-apnortheast2-17lxfxukvf.s3.ap-northeast-2.amazonaws.com',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
    proxyClientMaxBodySize: 50 * 1024 * 1024,
  },
};

export default nextConfig;
