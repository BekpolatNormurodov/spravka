#!/usr/bin/env bash
# Update to the latest master. Run as root from /opt/spravka:
#
#   bash deploy/update.sh
#
# Rolls back to the image that was running before if anything fails, so a bad deploy ends where it
# started. qrcode-pro is on the old server and is not affected by anything here.
#
# -E: without it an ERR trap is not inherited by functions, so wrapping any step below in one would
# drop the rollback silently — correct-looking script, half-updated box, on the one run it mattered.
set -Eeuo pipefail

ROOT="/opt/spravka"
APPS="public:5100 yurist:5101 admin:5102 rahbar:5103"

say()  { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
warn() { printf '\033[33m    %s\033[0m\n' "$1"; }
die()  { printf '\n\033[31mXATO: %s\033[0m\n' "$1" >&2; exit 1; }

[ -f "$ROOT/docker-compose.yml" ] || die "$ROOT topilmadi"
cd "$ROOT"
docker compose version >/dev/null 2>&1 || die "docker compose yo'q"
[ -f .env ] || die ".env yo'q — avval: cp .env.docker.example .env && nano .env"

say "Tekshiruv"
# A dirty tree means someone edited the server directly. `git pull` would either conflict or,
# worse, succeed and discard the change silently. Stop and let a human say which they meant.
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

# The running image, kept under a second tag so a failed build has something to come back to.
# Docker would otherwise overwrite spravka:latest and leave nothing to roll back to.
say "Zaxira"
if docker image inspect spravka:latest >/dev/null 2>&1; then
  docker tag spravka:latest spravka:previous
  echo "    spravka:latest -> spravka:previous"
  HAVE_PREV=1
else
  echo "    oldingi image yo'q (birinchi yangilanish)"
  HAVE_PREV=0
fi

rolled_back=0
rollback() {
  [ "$rolled_back" -eq 1 ] && return
  rolled_back=1
  warn ""
  warn "YIQILDI — qaytarilmoqda"
  git reset --hard --quiet "$OLD_SHA"
  if [ "$HAVE_PREV" -eq 1 ]; then
    docker tag spravka:previous spravka:latest
    # No --build: the point is to run the image that was working, not to rebuild from source that
    # may be what broke it.
    docker compose up -d --no-build || warn "rollback: up ham yiqildi — QO'LDA ARALASHISH KERAK"
    warn "Eski image qaytarildi. Yangilanish QO'LLANMADI."
  else
    warn "Qaytariladigan image yo'q — qo'lda tuzatish kerak."
  fi
}
trap 'rollback' ERR

say "Kod"
git merge --ff-only origin/master

say "Build"
# NEXT_PUBLIC_* is inlined at build time, so --build is not optional on an update: without it the
# containers restart with the old bundle and the deploy silently does nothing.
docker compose build

say "Baza"
# One-off container on the same network. `db push` refuses non-interactively when it would drop
# data rather than dropping it — if that stops the update, the schema change is asking for a human.
docker compose run --rm --no-deps -T public npm run db:push

say "Ishga tushirilmoqda"
docker compose up -d
sleep 5

say "Tekshirish"
# Container "up" is not health: a Next app accepts the port immediately and can still fail on the
# first request. Ask each one for an actual response.
failed=""
for pair in $APPS; do
  app="${pair%%:*}"; port="${pair##*:}"
  code="$(curl -s -o /dev/null -m 10 -w '%{http_code}' "http://127.0.0.1:$port/" || echo 000)"
  case "$code" in
    2??|3??) printf '    %-8s :%-5s %s\n' "$app" "$port" "$code" ;;
    *)       printf '    %-8s :%-5s \033[31m%s\033[0m\n' "$app" "$port" "$code"; failed="$failed $app" ;;
  esac
done

if [ -n "$failed" ]; then
  for a in $failed; do
    warn "--- docker compose logs $a ---"
    docker compose logs --tail 20 "$a" || true
  done
  false   # trips the ERR trap -> rollback
fi

trap - ERR
say "Tayyor"
git log --oneline -1
echo "    Qaytarish: docker tag spravka:previous spravka:latest && docker compose up -d --no-build"
