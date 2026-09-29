/** @type {import('next').NextConfig} */

const basePath = process.env.NEXT_PUBLIC_BASE_PATH && process.env.NEXT_PUBLIC_BASE_PATH.startsWith('/') 
  ? process.env.NEXT_PUBLIC_BASE_PATH 
  : '';

const nextConfig = {
  reactStrictMode: false,
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  images: {
    domains: [
      'images.unsplash.com',
      'i.ibb.co',
      'scontent.fotp8-1.fna.fbcdn.net',
    ],
    // Make ENV
    unoptimized: true,
  },
};

module.exports = nextConfig;
