import type { NextConfig } from 'next';
import withPWA from 'next-pwa';

const runtimeCaching = [
  {
    urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/api/'),
    handler: 'NetworkFirst',
    method: 'GET',
    options: { cacheName: 'finance-api', networkTimeoutSeconds: 8, expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 }, cacheableResponse: { statuses: [0, 200] } },
  },
  {
    urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/_next/static/') || /\.(?:js|css|png|jpg|jpeg|svg|webp|ico|woff2?)$/i.test(url.pathname),
    handler: 'CacheFirst',
    options: { cacheName: 'static-assets', expiration: { maxEntries: 160, maxAgeSeconds: 30 * 24 * 60 * 60 }, cacheableResponse: { statuses: [0, 200] } },
  },
];

const pwaConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching,
  fallbacks: {
    document: '/offline',
  },
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default pwaConfig(nextConfig);
