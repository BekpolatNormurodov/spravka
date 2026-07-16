/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@spravka/shared'],
  experimental: {
    // /m/[id]/pdf freezes a document that was signed before this existed, which means Chromium.
    // Puppeteer finds its browser at runtime; webpack cannot follow that, so it stays external.
    serverComponentsExternalPackages: ['puppeteer'],
  },
};
module.exports = nextConfig;
