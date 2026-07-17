#!/usr/bin/env bash
# One-time TLS bootstrap. Run once, after `bash deploy/init.sh` has the apps up:
#
#   sudo bash deploy/init-letsencrypt.sh
#
# Prereqs: the five names below resolve to THIS server, and :80 is reachable from the internet.
# Both are checked before certbot is called — see "Preflight" below.
#
# Renewal is not this script's job: the certbot container in docker-compose.yml runs `certbot renew`
# every 12h, and the nginx container reloads every 6h to pick up what it wrote.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# qrsystem.uz first: it names the directory under certs/live/ that default.conf points at.
# bright.qrsystem.uz is deliberately absent — it lives on the old server with qrcode-pro, so it
# resolves elsewhere, and asking for it would fail the certificate for these five as well.
DOMAINS=(qrsystem.uz www.qrsystem.uz yurist.qrsystem.uz admin.qrsystem.uz rahbar.qrsystem.uz)
EMAIL="${CERTBOT_EMAIL:-khurshidi2827@gmail.com}"
LIVE="/etc/letsencrypt/live/qrsystem.uz"

say() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
die() { printf '\n\033[31mXATO: %s\033[0m\n' "$1" >&2; exit 1; }

[ -f docker-compose.yml ] || die "$ROOT — spravka repo emas"
docker compose version >/dev/null 2>&1 || die "docker compose yo'q"

say "1/5 Dummy sertifikat — nginx 443 da koʻtarila olishi uchun"
# The circle this breaks: nginx will not start while ssl_certificate points at a missing file, and
# certbot cannot get the real file without nginx serving the challenge on :80. A throwaway
# self-signed cert lets nginx boot; step 4 replaces it.
docker compose run --rm --entrypoint "sh -c \
  'mkdir -p $LIVE && openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
   -keyout $LIVE/privkey.pem -out $LIVE/fullchain.pem -subj /CN=localhost'" certbot

say "2/5 nginx"
docker compose up -d nginx
sleep 3

say "3/5 Preflight — :80 tashqaridan ochiqmi"
# Ask over each name, from outside, before spending a certbot call. Let's Encrypt allows 5
# duplicate certificates a week; a burned quota locks you out for days. certbot fetches the
# challenge over EVERY name and a single one that does not answer fails the whole request — all
# five, not just that name. So this loop is cheap and the failure it prevents is not.
probe="preflight-$$"
docker compose exec -T nginx sh -c "mkdir -p /var/www/certbot/.well-known/acme-challenge && echo ok > /var/www/certbot/.well-known/acme-challenge/$probe"
bad=0
for d in "${DOMAINS[@]}"; do
  code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "http://$d/.well-known/acme-challenge/$probe" || echo 000)
  printf '    %-24s %s\n' "$d" "$code"
  [ "$code" = "200" ] || bad=1
done
docker compose exec -T nginx rm -f "/var/www/certbot/.well-known/acme-challenge/$probe" || true

if [ "$bad" -eq 1 ]; then
  die "Yuqorida 200 bermagan nom bor. Sertifikat olinmaydi. Tekshiring:
  - DNS shu serverga qaraydimi:  dig +short <nom>
  - :80 tashqaridan ochiqmi:     boshqa mashinadan curl -I http://<server-IP>/
  - nginx tirikmi:               docker compose ps nginx
Sabab tuzatilmaguncha certbot chaqirilmaydi — bu ataylab, Let's Encrypt limitini yoqib
yubormaslik uchun."
fi

say "4/5 Haqiqiy sertifikat"
docker compose run --rm --entrypoint "sh -c \
  'rm -rf /etc/letsencrypt/live/qrsystem.uz /etc/letsencrypt/archive/qrsystem.uz /etc/letsencrypt/renewal/qrsystem.uz.conf'" certbot

args=""
for d in "${DOMAINS[@]}"; do args="$args -d $d"; done

# shellcheck disable=SC2086
docker compose run --rm --entrypoint "certbot certonly --webroot -w /var/www/certbot \
  --cert-name qrsystem.uz $args \
  --email $EMAIL --agree-tos --no-eff-email --force-renewal" certbot

say "5/5 nginx reload"
docker compose exec nginx nginx -s reload
docker compose up -d certbot

echo
echo "Tayyor. HTTPS olindi: ${DOMAINS[*]}"
echo
echo "Tekshirish:"
for d in "${DOMAINS[@]}"; do echo "  curl -I https://$d/"; done
echo
echo "Yangilanish avtomatik: certbot konteyneri har 12 soatda renew qiladi, nginx har 6"
echo "soatda reload qiladi. Qoʻlda hech narsa qilish shart emas."
