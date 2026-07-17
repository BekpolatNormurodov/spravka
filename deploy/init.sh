#!/usr/bin/env bash
# First-time setup, Docker. Run once as root from /opt/spravka:
#
#   bash deploy/init.sh
#
# Idempotent — safe to re-run. Never overwrites .env, never resets a password that already exists.
#
# qrcode-pro is not here: it stays on the old server with its own database and keeps
# bright.qrsystem.uz. Two machines, two databases, nothing shared. See deploy/README.md.
#
# Does NOT do nginx or TLS — deploy/setup-ssl.sh and the two nginx configs, separate because those
# wait on DNS pointing here and :80 being open, neither of which is this box's decision. The apps
# come up on 127.0.0.1 regardless, so you can test before the certificate exists.
set -Eeuo pipefail

ROOT="/opt/spravka"
APPS="public:5100 yurist:5101 admin:5102 rahbar:5103"

say() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
die() { printf '\n\033[31mXATO: %s\033[0m\n' "$1" >&2; exit 1; }

say "Preflight"
[ "$(id -u)" -eq 0 ] || die "root kerak: sudo bash deploy/init.sh"
[ -f "$ROOT/docker-compose.yml" ] || die "$ROOT da kod yo'q. Avval: git clone <repo> $ROOT"
cd "$ROOT"
docker compose version >/dev/null 2>&1 || die "docker compose yo'q: https://docs.docker.com/engine/install/"

# Ports 5100-5103 must be free. Something already holding one is not a warning: compose would fail
# to publish it and the app would be up-but-unreachable, which reads exactly like a broken build.
for p in 5100 5101 5102 5103; do
  if ss -tln 2>/dev/null | grep -q ":$p "; then
    die "$p port band. Kim egallagani: ss -tlnp | grep :$p"
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
docker compose up -d
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

Keyingi qadam — nginx va sertifikat (alohida, chunki :80 ochilishini kutadi):

  cp deploy/nginx/snippets/spravka-proxy.conf /etc/nginx/snippets/
  cp deploy/nginx/spravka-http.conf /etc/nginx/conf.d/
  nginx -t && systemctl reload nginx
  bash deploy/setup-ssl.sh
  cp deploy/nginx/spravka-ssl.conf /etc/nginx/conf.d/
  nginx -t && systemctl reload nginx

Shundan keyin:
  qrsystem.uz          -> public  (chop etilgan QR ochadigan sahifa)
  yurist.qrsystem.uz   -> yurist
  admin.qrsystem.uz    -> admin
  rahbar.qrsystem.uz   -> rahbar

bright.qrsystem.uz shu serverda EMAS — u eski mashinada, qrcode-pro bilan.
EOF
