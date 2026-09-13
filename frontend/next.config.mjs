/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Optional: Rewrite API calls locally or in deployment if desired
  async rewrites() {
    return [
      {
        source: '/api-proxy/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
