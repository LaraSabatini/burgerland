import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '11mb' },
  },
  serverExternalPackages: ['@libsql/client', 'exceljs'],
}

export default nextConfig
