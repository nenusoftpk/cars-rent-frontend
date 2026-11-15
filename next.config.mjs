// Normal mode:  npm run dev / npm run build / npm start
// Static mode (future Electron build): npm run build:static  -> outputs ./out
// See README "Electron / static export notes" for limitations.
const isExport = process.env.NEXT_EXPORT === 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  ...(isExport ? { output: 'export', trailingSlash: true } : {}),
};

export default nextConfig;
