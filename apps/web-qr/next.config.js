/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // No `output: "standalone"` — that came from qrcode-pro's Docker image, which did not
  // move with the app. deploy/systemd runs `next start` for every app, and Next refuses to
  // serve a standalone build that way.
  // @spravka/shared ships TypeScript source, not a build — Next must compile it.
  transpilePackages: ["@spravka/shared"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

module.exports = nextConfig;
