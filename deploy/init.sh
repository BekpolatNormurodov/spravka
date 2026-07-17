#!/usr/bin/env bash
# First-time setup, Docker. Run once as root, from anywhere in the repo:
#
#   sudo bash deploy/init.sh
#
# Idempotent — safe to re-run. Never overwrites .env, never resets a password that already exists.
#
# qrcode-pro is not here: it stays on the old server with its own database and keeps
# bright.qrsystem.uz. Two machines, two databases, nothing shared. See deploy/README.md.
#
# Does NOT issue the certificate — that is deploy/init-letsencrypt.sh, kept separate because it
# waits on DNS pointing here and :80 being reachable, neither of which is this box's decision. The
# apps come up on 127.0.0.1 regardless, so the system can be tested before TLS exists.
set -Eeuo pipefail

# Where the repo actually is, worked out from this file — not a hardcoded /opt/spravka. The path is
# not the script's to dictate, and an earlier version that did refused to run on a clone in $HOME
# while telling the operator to clone the repo they were standing in. Works from the repo root
# (`bash deploy/init.sh`) or from inside deploy/ (`bash init.sh`).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APPS="public:5100 yurist:5101 admin:5102 rahbar:5103"

say() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
die() { printf '\n\033[31mXATO: %s\033[0m\n' "$1" >&2; exit 1; }

say "Preflight"
[ "$(id -u)" -eq 0 ] || die "root kerak: sudo bash deploy/init.sh"
[ -f "$ROOT/docker-compose.yml" ] || die "$ROOT — spravka repo emas (docker-compose.yml yo'q)"
cd "$ROOT"
echo "    repo: $ROOT"
docker compose version >/dev/null 2>&1 || die "docker compose yo'q: https://docs.docker.com/engine/install/"

# These must be free. Something already holding one is not a warning: compose fails to publish it
# and the app comes up unreachable, which reads exactly like a broken build and is not one.
# 80/443 matter most — a host nginx or apache installed by habit will hold them and the failure
# arrives later, during init-letsencrypt.sh, looking like a certificate problem.
for p in 80 443 5100 5101 5102 5103; do
  if ss -tln 2>/dev/null | grep -q ":$p "; then
    echo "    $p portini kim egallagan:"
    ss -tlnp 2>/dev/null | grep ":$p " | sed 's/^/      /'
    die "$p port band. Host nginx bo'lsa: systemctl disable --now nginx"
  fi
done

say ".env"
if [ -f .env ]; then
  echo "    mavjud — tegilmadi"
else
  cp .env.docker.example .env
  # Generated rather than left blank: a human filling four secrets by hand gets one wrong, and the
  # ones here fail in ways that do not name themselves — a weak AUTH_SECRET forges sessions, a
  # missing one refuses to boot.
  #
  # tr strips # and $: compose reads .env, and those characters change meaning inside it.
  sed -i "s|^MYSQL_ROOT_PASSWORD=.*|MYSQL_ROOT_PASSWORD=$(openssl rand -base64 24 | tr -d '#$/+=\n')|" .env
  sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=$(openssl rand -base64 48 | tr -d '#$\n')|" .env
  sed -i "s|^SEED_PASSWORD=.*|SEED_PASSWORD=$(openssl rand -base64 18 | tr -d '#$\n')|" .env
  chmod 600 .env
  echo "    yaratildi, parollar generatsiya qilindi"
  echo "    NEXT_PUBLIC_PUBLIC_URL tekshiring — u build'da kodga QOTIB QOLADI:"
  grep '^NEXT_PUBLIC_PUBLIC_URL=' .env | sed 's/^/      /'
fi

say "Build"
# NEXT_PUBLIC_PUBLIC_URL is read from .env here and inlined into the bundle. Changing it later
# needs a rebuild, not a restart — and documents already issued keep the old QR forever.
docker compose build

say "Baza"
docker compose up -d mysql
echo "    mysql sogʻlom boʻlishini kutamiz..."
for _ in $(seq 1 60); do
  docker compose ps mysql --format '{{.Health}}' 2>/dev/null | grep -q healthy && break
  sleep 2
done
docker compose ps mysql --format '{{.Health}}' 2>/dev/null | grep -q healthy || die "mysql koʻtarilmadi: docker compose logs mysql"

docker compose run --rm --no-deps -T public npm run db:push

# The seed is safe to re-run — its upsert sets passwordHash only when creating — but the password
# is only worth printing when it was actually applied. Announcing a generated one on a re-run
# would be a lie the operator finds out about at the login screen.
users="$(docker compose run --rm --no-deps -T public node -e \
  'const{PrismaClient}=require("@prisma/client");const p=new PrismaClient();
   p.user.count().then(n=>console.log(n)).catch(()=>console.log(0)).finally(()=>p.$disconnect())' \
  2>/dev/null | tr -dc '0-9' || echo 0)"

docker compose run --rm --no-deps -T public npm run db:seed

say "Ishga tushirilmoqda"
# Not nginx: it needs a certificate to exist before it will start, and init-letsencrypt.sh writes
# a dummy one for exactly that. Bringing it up here would fail on a missing file and make the
# whole run look broken when the apps are fine.
docker compose up -d mysql public yurist admin rahbar
sleep 5

say "Holat"
failed=0
for pair in $APPS; do
  app="${pair%%:*}"; port="${pair##*:}"
  code="$(curl -s -o /dev/null -m 10 -w '%{http_code}' "http://127.0.0.1:$port/" || echo 000)"
  case "$code" in
    2??|3??) printf '    %-8s :%-5s %s\n' "$app" "$port" "$code" ;;
    *)       printf '    %-8s :%-5s \033[31m%s\033[0m  docker compose logs %s\n' "$app" "$port" "$code" "$app"; failed=1 ;;
  esac
done

echo
if [ "${users:-0}" -eq 0 ]; then
  echo "──────────────────────────────────────────────────────────"
  echo " Login (yurist / admin / rahbar) paroli — .env ichida:"
  grep '^SEED_PASSWORD=' .env | sed 's/^/   /'
  echo " Birinchi kirgandan keyin har biri oʻzinikini qoʻysin."
  echo "──────────────────────────────────────────────────────────"
else
  echo "    bazada $users foydalanuvchi bor edi — parollar tegilmadi"
fi

[ "$failed" -eq 0 ] || die "app'lar koʻtarilmadi — yuqoridagi logs'ni qarang"

cat <<'EOF'

App'lar tayyor. nginx hali koʻtarilmagan — unga sertifikat kerak.

Keyingi qadam, DNS shu serverga qaragandan keyin:

  sudo bash deploy/init-letsencrypt.sh

U dummy sertifikat yozadi (nginx koʻtarilishi uchun), :80 ni tekshiradi,
haqiqiy sertifikat oladi va nginx'ni reload qiladi. Yangilanish keyin
avtomatik — certbot konteyneri har 12 soatda, nginx har 6 soatda reload.

Shundan keyin:
  qrsystem.uz          -> public  (chop etilgan QR ochadigan sahifa)
  yurist.qrsystem.uz   -> yurist
  admin.qrsystem.uz    -> admin
  rahbar.qrsystem.uz   -> rahbar

bright.qrsystem.uz shu serverda EMAS — u eski mashinada, qrcode-pro bilan.
EOF
