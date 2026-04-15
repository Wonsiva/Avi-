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
};

module.exports = nextConfig;
