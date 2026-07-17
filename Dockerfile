# One image, four apps. Which one a container runs is decided by $APP at start — the four differ
# only in which .next they serve, and four near-identical Dockerfiles would drift apart.
#
# The old qrcode-pro stack is untouched by this: its own compose, its own MySQL on 3308, its own
# nginx on 8090. Nothing here shares a port, a volume or a network with it.
FROM node:22-bookworm-slim

# openssl: Prisma needs it to pick its engine and fails at query time, not at build, without it.
# ca-certificates: TLS to the outside (E-IMZO is client-side, but npm and Chromium are not).
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Inside the image, not $HOME: the app user must be able to read it, and $HOME moves around.
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer

# Manifests first, so a source edit does not re-run npm ci. Every workspace's package.json has to
# be here or npm ci fails on the workspace glob — web-qr included, even though it is not built
# below: qrcode-pro still serves that role and this image does not replace it.
COPY package.json package-lock.json ./
COPY packages/shared/package.json    packages/shared/
COPY apps/web-public/package.json    apps/web-public/
COPY apps/web-yurist/package.json    apps/web-yurist/
COPY apps/web-admin/package.json     apps/web-admin/
COPY apps/web-rahbar/package.json    apps/web-rahbar/
COPY apps/web-qr/package.json        apps/web-qr/
RUN npm ci

# Chromium for the signing render. Puppeteer's own list, not a hand-written apt line: Ubuntu/Debian
# renamed half of these with a t64 suffix and apt installs NOTHING when one name is wrong.
RUN npx puppeteer browsers install chrome --install-deps \
 && rm -rf /var/lib/apt/lists/*

COPY . .

# NEXT_PUBLIC_* is inlined by `next build` — it is a BUILD input, not a runtime one. Setting it in
# compose `environment:` would do nothing at all. Get it wrong and every QR printed from this image
# points somewhere dead, permanently: the PDFs are frozen and cannot be reissued.
ARG NEXT_PUBLIC_PUBLIC_URL=https://qrsystem.uz
ENV NEXT_PUBLIC_PUBLIC_URL=$NEXT_PUBLIC_PUBLIC_URL

RUN npm run db:generate \
 && npm run build -w @spravka/web-public -w @spravka/web-yurist -w @spravka/web-admin -w @spravka/web-rahbar

ENV NODE_ENV=production

# 0.0.0.0 is right *here* — it is the container's own network. The host binding in
# docker-compose.yml is what keeps these off the public IP (127.0.0.1:PORT:PORT).
#
# Not `npm start`: that script hardcodes its own -H and -p for local dev, and would ignore $PORT.
# cd rather than `next start <dir>` — this is the form the systemd unit already runs in production.
CMD ["sh", "-c", "cd apps/web-${APP} && exec npx next start -H 0.0.0.0 -p ${PORT}"]
