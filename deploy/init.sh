#!/usr/bin/env bash
# First-time server setup. Run once as root, from /opt/spravka:
#
#   DATABASE_URL="mysql://spravka:PAROL@localhost:3306/spravka" bash deploy/init.sh
#
# Idempotent — safe to re-run. It never overwrites a .env that already exists and never re-seeds a
# database that already has users, so a second run repairs rather than resets.
#
# What it does NOT do: nginx and TLS. Those are deploy/setup-ssl.sh and the two nginx configs, and
# they are separate on purpose — they can only run once the network team has opened :80, which is
# outside this box. See deploy/README.md.
set -euo pipefail

ROOT="/opt/spravka"
STORAGE="/var/lib/spravka/storage"
PUBLIC_URL="${PUBLIC_URL:-https://qrsystem.uz}"
QR_URL="${QR_URL:-https://bright.qrsystem.uz}"

# app:port. These are the ports nginx proxies to; changing one here means changing the nginx
# upstream too. web-qr is 5000 because that is where bright.qrsystem.uz already points.
APPS="qr:5000 public:5100 yurist:5101 admin:5102 rahbar:5103"

say() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
die() { printf '\n\033[31mXATO: %s\033[0m\n' "$1" >&2; exit 1; }

say "Preflight"
[ "$(id -u)" -eq 0 ] || die "root kerak: sudo bash deploy/init.sh"
[ -f "$ROOT/package.json" ] || die "$ROOT da kod yo'q. Avval: git clone <repo> $ROOT"
cd "$ROOT"

command -v node  >/dev/null || die "node yo'q. apt/nodesource orqali o'rnating (nvm EMAS — systemd'da ProtectHome=true, \$HOME ko'rinmaydi)"
command -v mysql >/dev/null || die "mysql-server yo'q: apt install mysql-server"

# Node 22+. The apps are built against it and Next 14 fails in ways that do not name the version.
node_major="$(node -p 'process.versions.node.split(".")[0]')"
[ "$node_major" -ge 22 ] || die "Node $node_major topildi, 22+ kerak"

# The one thing this script cannot invent. Everything else below is derivable; the database
# password is not, and guessing it would produce five apps that boot and then fail on first query.
if [ -f .env ] && grep -q '^DATABASE_URL=' .env; then
  DATABASE_URL="$(grep '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"')"
  echo "    DATABASE_URL — mavjud .env dan olindi"
else
  [ -n "${DATABASE_URL:-}" ] || die "DATABASE_URL berilmadi. Masalan:
      DATABASE_URL=\"mysql://spravka:PAROL@localhost:3306/spravka\" bash deploy/init.sh
  Port 3306 — native MySQL. 3310 dev'niki (deploy/docker-compose.dev.yml), serverda unda hech narsa yo'q."
fi

case "$DATABASE_URL" in
  *:3310/*) die "DATABASE_URL 3310 portini ko'rsatyapti — bu lokal dev bazasi. Serverda 3306." ;;
esac

say "Foydalanuvchi va papkalar"
id spravka >/dev/null 2>&1 || useradd -r -s /usr/sbin/nologin spravka
# Issued documents. Not a cache — a lost file here cannot be re-made, only re-rendered into a
# different file with different bytes. deploy/README.md says why this belongs in the DB backup.
mkdir -p "$STORAGE"
chown -R spravka:spravka /var/lib/spravka
# web-qr writes these at runtime; systemd's ReadWritePaths lists them but does not create them.
mkdir -p "$ROOT/apps/web-qr/public/uploads" "$ROOT/apps/web-qr/public/qr"

say "Bogʻliqliklar"
export PUPPETEER_CACHE_DIR="$ROOT/.cache/puppeteer"
npm ci
# Signing renders the document with headless Chromium. Its library list is not hand-written here:
# Ubuntu 24.04 renamed half of them with a t64 suffix and apt installs NOTHING if one name is
# wrong. Puppeteer knows its own list. Skipped silently if the browser is already there.
npx puppeteer browsers install chrome --install-deps

say "AUTH_SECRET"
# Reused across all five apps: a session cookie set by one must verify in the others. Generated
# once and kept — regenerating it on a re-run would log every user out for no reason.
if [ -f .env ] && grep -q '^AUTH_SECRET=' .env; then
  AUTH_SECRET="$(grep '^AUTH_SECRET=' .env | head -1 | cut -d= -f2- | tr -d '"')"
  echo "    mavjud .env dan olindi"
else
  # base64 can emit '#' and '$', which systemd's EnvironmentFile parser does not read the way
  # dotenv does. tr strips them rather than hoping.
  AUTH_SECRET="$(openssl rand -base64 48 | tr -d '#$\n')"
  echo "    yangi yaratildi"
fi

say "Root .env"
if [ -f .env ]; then
  echo "    mavjud — tegilmadi"
else
  cat > .env <<EOF
DATABASE_URL="$DATABASE_URL"
AUTH_SECRET="$AUTH_SECRET"
EOF
  chmod 600 .env
fi

say "Har bir app uchun .env"
# Written rather than left to nano. PORT is the reason: unset, systemd expands `next start -p `
# with an empty value and the app crash-loops behind a 502 that looks like a proxy fault.
#
# NEXT_PUBLIC_* is baked into the bundle by `next build` below, so these files must be right
# BEFORE the build, not after. A wrong NEXT_PUBLIC_PUBLIC_URL puts a dead link in the QR of every
# document issued from that build, and those PDFs are frozen — it cannot be corrected later.
for pair in $APPS; do
  app="${pair%%:*}"; port="${pair##*:}"
  f="$ROOT/apps/web-$app/.env"
  if [ -f "$f" ]; then
    echo "    web-$app — mavjud, tegilmadi"
    continue
  fi
  {
    echo "DATABASE_URL=\"$DATABASE_URL\""
    echo "AUTH_SECRET=\"$AUTH_SECRET\""
    echo "PORT=$port"
    case "$app" in
      qr)
        echo "NEXT_PUBLIC_APP_URL=\"$QR_URL\""
        # web-qr has its own login, separate from the User table. Unset, it silently rejects every
        # password and logs nothing — so a value is written here and printed at the end.
        echo "ADMIN_USERNAME=\"admin\""
        echo "ADMIN_PASSWORD=\"$(openssl rand -base64 12 | tr -d '#$/+=\n')\""
        ;;
      public|rahbar|admin)
        echo "NEXT_PUBLIC_PUBLIC_URL=\"$PUBLIC_URL\""
        echo "CERT_STORAGE_DIR=\"$STORAGE\""
        ;;
      yurist)
        echo "NEXT_PUBLIC_PUBLIC_URL=\"$PUBLIC_URL\""
        ;;
    esac
  } > "$f"
  chmod 600 "$f"
  echo "    web-$app — yozildi (PORT=$port)"
done

say "Baza"
npm run db:generate
# `prisma db push` refuses non-interactively when it would drop data, rather than dropping it.
# That refusal is the feature — do not add --accept-data-loss to make an error go away.
npm run db:push

# The seed itself is safe to re-run: its upsert sets passwordHash only in the `create` branch, so
# existing people keep the password they have. The count is not about safety — it is about not
# printing a password at the end that was never applied. On a re-run the generated one goes
# nowhere, and announcing it would be a lie the operator only discovers at the login screen.
users="$(DATABASE_URL="$DATABASE_URL" node -e \
  'const{PrismaClient}=require("@prisma/client");const p=new PrismaClient();
   p.user.count().then(n=>console.log(n)).catch(()=>console.log(0)).finally(()=>p.$disconnect())' \
  2>/dev/null || echo 0)"

SEED_PW="$(openssl rand -base64 18)"
SEED_PASSWORD="$SEED_PW" NODE_ENV=production npm run db:seed
if [ "${users:-0}" -gt 0 ]; then
  echo "    bazada $users foydalanuvchi bor edi — firmalar yangilandi, parollar tegilmadi"
  SEED_PW=""
fi

say "Build — beshalasi"
# NODE_ENV is deliberately not production here: the build needs devDependencies.
npm run build

say "Egalik"
# After the build, not before: npm and next both write as root, and the services run as spravka.
# systemd's ReadWritePaths lets them write .next — that permission is useless if root owns it.
chown -R spravka:spravka "$ROOT"

say "Servislar"
cp deploy/systemd/spravka@.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now spravka@public spravka@yurist spravka@admin spravka@rahbar spravka@qr

sleep 3
say "Holat"
failed=0
for pair in $APPS; do
  app="${pair%%:*}"; port="${pair##*:}"
  if systemctl is-active --quiet "spravka@$app"; then
    code="$(curl -s -o /dev/null -m 5 -w '%{http_code}' "http://127.0.0.1:$port/" || echo 000)"
    printf '    %-8s active   :%s -> %s\n' "$app" "$port" "$code"
  else
    printf '    %-8s \033[31mDOWN\033[0m     journalctl -u spravka@%s -n 30\n' "$app" "$app"
    failed=1
  fi
done

echo
if [ -n "$SEED_PW" ]; then
  echo "──────────────────────────────────────────────────────────"
  echo " Login parol (yurist / admin / rahbar):  $SEED_PW"
  echo " web-qr admin paroli:  apps/web-qr/.env ichida"
  echo " SAQLAB QOʻYING — bu parol boshqa koʻrsatilmaydi."
  echo "──────────────────────────────────────────────────────────"
fi

[ "$failed" -eq 0 ] || die "app'lar ko'tarilmadi — yuqoridagi journalctl'ni qarang"

cat <<'EOF'

Keyingi qadam — nginx va sertifikat (alohida, chunki :80 ochilishini kutadi):

  cp deploy/nginx/snippets/spravka-proxy.conf /etc/nginx/snippets/
  cp deploy/nginx/spravka-http.conf /etc/nginx/conf.d/
  nginx -t && systemctl reload nginx
  bash deploy/setup-ssl.sh
  cp deploy/nginx/spravka-ssl.conf /etc/nginx/conf.d/
  nginx -t && systemctl reload nginx

Eski QR'lar (bright.qrsystem.uz) — deploy/README.md dagi koʻchirish boʻlimi.
Usiz eski QR'larning hammasi 404 beradi.
EOF
