import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The default bottom-left spot covers the sidebar's "Sign out" button.
  devIndicators: { position: 'bottom-right' },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
