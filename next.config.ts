import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdfkit', 'better-sqlite3', 'socket.io'],
  turbopack: {
    resolveAlias: {
      'mapbox-gl': 'mapbox-gl/dist/mapbox-gl.js',
    },
  },
};

export default nextConfig;
