#!/usr/bin/env bash
# One Let's Encrypt certificate covering every spravka hostname, over HTTP-01.
# Run on the server as root. Idempotent — safe to re-run.
#
# Order matters. At this point /etc/nginx/conf.d/ must contain spravka-http.conf
# and NOT yet spravka-ssl.conf: the ssl file names cert files that do not exist
# yet, and nginx will not start while it points at a missing file. Install the
# ssl file after this script succeeds.
set -euo pipefail

EMAIL="${CERTBOT_EMAIL:-khurshidi2827@gmail.com}"
WEBROOT="/var/www/certbot"

# The lead name becomes the directory under /etc/letsencrypt/live/, which
# spravka-ssl.conf points at. Keep qrsystem.uz first or update the conf to match.
#
# Every name here must resolve to this server BEFORE running: certbot proves control by fetching
# a file over each one, and a single NXDOMAIN fails the whole request — all seven, not just that
# name. Verified 2026-07-17: all seven answer 213.230.64.140.
#
# qrsystem.uz is web-public, the page a printed QR opens — hence first, and hence the cert
# directory name.
DOMAINS=(
  qrsystem.uz
  www.qrsystem.uz
  yurist.qrsystem.uz
  admin.qrsystem.uz
  rahbar.qrsystem.uz
  bright.qrsystem.uz
  www.bright.qrsystem.uz
)

echo "==> Preflight"
command -v certbot >/dev/null || { echo "certbot yoʻq: apt install certbot python3-certbot-nginx"; exit 1; }
command -v nginx   >/dev/null || { echo "nginx yoʻq"; exit 1; }

if [ -f /etc/nginx/conf.d/spravka-ssl.conf ] && [ ! -d "/etc/letsencrypt/live/${DOMAINS[0]}" ]; then
  echo "XATO: spravka-ssl.conf oʻrnatilgan, lekin sertifikat yoʻq — nginx koʻtarilmaydi."
  echo "      Uni vaqtincha olib turing, shu skriptni ishga tushiring, keyin qaytaring."
  exit 1
fi

mkdir -p "$WEBROOT/.well-known/acme-challenge"
chown -R www-data:www-data "$WEBROOT"

echo "==> nginx config test (hozircha faqat :80 boʻlishi kerak)"
nginx -t
systemctl reload nginx

# HTTP-01 means Let's Encrypt connects to port 80 from the internet. Proven
# closed on this host (FortiGate holds :443, :80 is not forwarded at all), so
# check it here rather than reading a certbot timeout stack trace.
echo "==> :80 tashqaridan ochiqmi tekshirilmoqda"
probe="$WEBROOT/.well-known/acme-challenge/preflight-$$"
echo ok > "$probe"
for d in "${DOMAINS[@]}"; do
  code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "http://$d/.well-known/acme-challenge/preflight-$$" || echo 000)
  printf '    %-24s %s\n' "$d" "$code"
  if [ "$code" != "200" ]; then
    rm -f "$probe"
    echo
    echo "TOʻXTATILDI: $d uchun :80 tashqaridan yopiq (javob: $code)."
    echo "FortiGate'da 80 va 443 portlarini serverga forward qilish kerak."
    echo "Sertifikat bunisiz olinmaydi — batafsil: deploy/README.md"
    exit 1
  fi
done
rm -f "$probe"

args=()
for d in "${DOMAINS[@]}"; do args+=(-d "$d"); done

echo "==> Sertifikat soʻrash: ${DOMAINS[*]}"
# --keep-until-expiring prevents a needless re-issue on re-runs. Let's Encrypt
# rate-limits duplicate certs to 5/week and a burned quota locks you out for days.
#
# --deploy-hook is not optional here. With --webroot, certbot renews the files and stops; nginx
# holds the old certificate open until something reloads it. Nothing would. The renewal succeeds
# every 60 days, the timer reports success, and on day 90 every site starts warning that the
# certificate expired — with a valid one sitting on disk. The hook is stored in the renewal
# config, so `certbot renew` picks it up forever after, not just today.
certbot certonly \
  --webroot -w "$WEBROOT" \
  "${args[@]}" \
  --email "$EMAIL" \
  --agree-tos --no-eff-email \
  --keep-until-expiring \
  --deploy-hook "systemctl reload nginx" \
  --non-interactive

echo
echo "==> Sertifikat olindi. Endi SSL configni oʻrnating:"
echo "    cp deploy/nginx/spravka-ssl.conf /etc/nginx/conf.d/"
echo "    nginx -t && systemctl reload nginx"

echo "==> Avtomatik yangilanish"
systemctl enable --now certbot.timer
systemctl list-timers certbot.timer --no-pager || true

echo
echo "Tekshirish:"
echo "  certbot certificates"
echo "  curl -I https://yurist.qrsystem.uz/"
