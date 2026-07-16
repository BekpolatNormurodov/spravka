/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@spravka/shared'],
  experimental: {
    // Signing renders the document with headless Chromium. Puppeteer finds its browser and its
    // native bits at runtime, which webpack cannot follow — bundled, the launch fails.
    serverComponentsExternalPackages: ['puppeteer'],
  },
};
module.exports = nextConfig;
