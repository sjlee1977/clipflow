import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['fluent-ffmpeg', '@ffmpeg-installer/ffmpeg'],
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
};

export default nextConfig;
