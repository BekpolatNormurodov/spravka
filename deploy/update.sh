#!/usr/bin/env bash
# Update to the latest master. Run as root from /opt/spravka:
#
#   bash deploy/update.sh
#
# Takes the site down for the few minutes it takes to build, on purpose — see "Downtime" below.
# On any failure it rolls back to the commit that was running before, rebuilds it and brings it
# back up, so a bad deploy ends where it started rather than half-applied.
#
# Downtime, and why it is deliberate:
#   npm ci deletes node_modules and rewrites it. `next build` overwrites the .next the running
#   server is reading from. Doing either underneath a live app does not fail cleanly — it fails
#   later, in whichever request first needs a chunk that moved. A predictable two-minute stop is
#   worth more than an unpredictable half-broken one.
#
# -E matters: without it an ERR trap is not inherited by functions, so wrapping any step below in
# one would drop the rollback silently — the script would still look correct and would leave a
# half-updated box on the one run where it mattered. Measured, not assumed.
set -Eeuo pipefail

ROOT="/opt/spravka"
APPS="qr:5000 public:5100 yurist:5101 admin:5102 rahbar:5103"
UNITS="spravka@public spravka@yurist spravka@admin spravka@rahbar spravka@qr"

say()  { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
warn() { printf '\033[33m    %s\033[0m\n' "$1"; }
die()  { printf '\n\033[31mXATO: %s\033[0m\n' "$1" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "root kerak: sudo bash deploy/update.sh"
[ -f "$ROOT/package.json" ] || die "$ROOT topilmadi"
cd "$ROOT"
export PUPPETEER_CACHE_DIR="$ROOT/.cache/puppeteer"

say "Tekshiruv"
# A dirty tree means someone edited the server directly. `git pull` would either conflict or, worse,
# succeed and silently discard the change. Stop and let a human decide which they meant.
if ! git diff --quiet || ! git diff --cached --quiet; then
  git status --short
  die "Serverda commit qilinmagan o'zgarish bor (yuqorida).
  Saqlash:   git stash
  Tashlash:  git checkout -- ."
fi

OLD_SHA="$(git rev-parse HEAD)"
echo "    hozirgi: $(git log --oneline -1)"

git fetch --quiet origin
NEW_SHA="$(git rev-parse origin/master)"
if [ "$OLD_SHA" = "$NEW_SHA" ]; then
  echo "    origin/master bilan bir xil — yangilanish yo'q"
  exit 0
fi
echo "    yangi:   $(git log --oneline -1 origin/master)"
echo "    $(git rev-list --count "$OLD_SHA..$NEW_SHA") ta commit keladi"

# Everything from here can fail, and if it does the tree is already on the new commit with a
# half-written .next. Put it back the way it was and bring it up, rather than leaving a broken box.
rolled_back=0
rollback() {
  [ "$rolled_back" -eq 1 ] && return
  rolled_back=1
  warn ""
  warn "YIQILDI — $OLD_SHA ga qaytarilmoqda"
  git reset --hard --quiet "$OLD_SHA"
  npm ci --silent    || warn "rollback: npm ci ham yiqildi"
  npm run build      || warn "rollback: build ham yiqildi — QO'LDA ARALASHISH KERAK"
  chown -R spravka:spravka "$ROOT"
  systemctl start $UNITS || true
  warn "Eski versiya qaytarildi. Yangilanish QO'LLANMADI."
}
trap 'rollback' ERR

say "To'xtatilmoqda"
systemctl stop $UNITS

say "Kod"
git merge --ff-only origin/master

say "Bogʻliqliklar"
npm ci
# Cheap when the browser is already cached; catches the case where a puppeteer bump needs a new one.
npx puppeteer browsers install chrome >/dev/null

say "Baza"
npm run db:generate
# Refuses non-interactively when it would drop data instead of dropping it. If this stops the
# update, that is the schema change asking for a human — not a flag to silence.
npm run db:push

say "Build"
npm run build

say "Egalik"
# npm and next wrote as root; the services run as spravka and must be able to write .next.
chown -R spravka:spravka "$ROOT"

say "Ishga tushirilmoqda"
systemctl start $UNITS
sleep 4

say "Tekshirish"
# is-active is not enough: a Next app answers systemd immediately and then fails on the first
# request. Ask each port for an actual response.
failed=""
for pair in $APPS; do
  app="${pair%%:*}"; port="${pair##*:}"
  code="$(curl -s -o /dev/null -m 8 -w '%{http_code}' "http://127.0.0.1:$port/" || echo 000)"
  # 2xx/3xx are both fine — every app redirects anonymous callers to /login.
  case "$code" in
    2??|3??) printf '    %-8s :%-5s %s\n' "$app" "$port" "$code" ;;
    *)       printf '    %-8s :%-5s \033[31m%s\033[0m\n' "$app" "$port" "$code"; failed="$failed $app" ;;
  esac
done

if [ -n "$failed" ]; then
  for a in $failed; do
    warn "--- journalctl -u spravka@$a ---"
    journalctl -u "spravka@$a" -n 15 --no-pager || true
  done
  false   # trips the ERR trap -> rollback
fi

trap - ERR
say "Tayyor"
git log --oneline -1
echo "    Eski versiya: $OLD_SHA"
echo "    Qaytarish:    git reset --hard $OLD_SHA && bash deploy/update.sh"
