/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  
  // Image optimization domains (for stock logos, news images, etc.)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  
  // Environment variable validation
  env: {
    CUSTOM_KEY: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'configured' : 'missing',
  },
};

module.exports = nextConfig;
