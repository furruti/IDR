import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/SGC/index.html', destination: '/cctv', permanent: false },
      { source: '/SGI/index.html', destination: '/materiales', permanent: false },
      { source: '/SGR/index.html', destination: '/racks', permanent: false },
      { source: '/SGL/index.html', destination: '/licencias', permanent: false },
      { source: '/SGP/index.html', destination: '/patcheras', permanent: false },
    ];
  },
};
export default nextConfig;
