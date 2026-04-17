/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Spotify's CDN hosts album art on a few subdomains.
    remotePatterns: [
      { protocol: 'https', hostname: 'i.scdn.co' },
      { protocol: 'https', hostname: 'mosaic.scdn.co' },
      { protocol: 'https', hostname: 'image-cdn-ak.spotifycdn.com' },
      { protocol: 'https', hostname: 'image-cdn-fa.spotifycdn.com' },
    ],
  },

  // Proxy /api/* to the Express backend so the browser sees everything as
  // same-origin. This lets us expose just one URL via a tunnel and avoids
  // cross-origin cookie headaches.
  async rewrites() {
    const backend = process.env.BACKEND_URL || 'http://127.0.0.1:4000';
    return [
      { source: '/api/:path*', destination: `${backend}/api/:path*` },
    ];
  },
};

module.exports = nextConfig;
