# Spravka — deploy (nginx + certbot)

Server: `213.230.64.140` · domenlar `qrsystem.uz` ostida.

## ⛔ Avval hal qilinishi shart: 80-port yopiq

Tekshirildi (2026-07-16, tashqi tarmoqdan):

```
213.230.64.140:80    yopiq          <-- certbot HTTP-01 shu portni talab qiladi
213.230.64.140:443   OCHIQ, lekin javob bergani nginx emas:
                     subject= O = Fortinet Ltd., CN = FortiGate  (self-signed)
213.230.64.140:8090  yopiq
```

Nazorat testi: aynan shu mashinadan `google.com` haqiqiy Google sertifikatini
qaytaradi va uning 80-porti ochiq — demak bu bizning tarafimizdagi intercept
emas. **443-portni FortiGate xavfsizlik devorining o'zi ushlab turibdi, 80-port
esa umuman ochilmagan.**

Buning oqibati:

- **HTTP-01 ishlamaydi** — Let's Encrypt 80-portga ulana olmaydi.
- **TLS-ALPN-01 ham ishlamaydi** — 443 nginx'ga yetib bormaydi.

Ya'ni hech qanday nginx sozlamasi buni aylanib o'ta olmaydi. Tarmoq
administratori FortiGate'da **VIP / port-forward** ochishi kerak:

| Tashqi | → | Ichki |
|---|---|---|
| `213.230.64.140:80` | → | server:80 |
| `213.230.64.140:443` | → | server:443 |

443 hozir FortiGate'ning o'z portali bilan band — u boshqa portga ko'chirilishi
yoki VIP undan ustun qo'yilishi kerak.

Agar port ochish umuman mumkin bo'lmasa, yagona yo'l — **DNS-01** challenge
(domen provayderining API kaliti kerak), u 80-portsiz ishlaydi.

DNS tarafi soz — hammasi to'g'ri IP'ga hal bo'ladi:

```
qrsystem.uz            -> 213.230.64.140
bright.qrsystem.uz     -> 213.230.64.140
www.bright...          -> 213.230.64.140
yurist.qrsystem.uz     -> 213.230.64.140  (CNAME qrsystem.uz)
admin.qrsystem.uz      -> 213.230.64.140  (CNAME qrsystem.uz)
rahbar.qrsystem.uz     -> 213.230.64.140  (CNAME qrsystem.uz)
```

## ⚠️ Public domen hali tanlanmagan

`web-public` (:5100) — bu **chop etilgan QR ochadigan sahifa**. Unga hech qanday
domen ajratilmagan (`spravka.qrsystem.uz` — NXDOMAIN).

QR kod qog'ozga bosiladi va **keyin o'zgartirib bo'lmaydi**: berilgan
ma'lumotnomani qayta chop etib bo'lmaydi. Shuning uchun domen bir marta
tanlanib, abadiy o'zgarmasligi kerak. Tanlangach:

1. DNS'ga A yoki CNAME yozuvi qo'shing.
2. To'rttala `.env` da `NEXT_PUBLIC_PUBLIC_URL=https://<domen>` qiling.
3. `setup-ssl.sh` dagi `DOMAINS` ga qo'shing.
4. `nginx/spravka-http.conf` ga :80 blokini, `nginx/spravka-ssl.conf` oxiridagi
   izohga olingan :443 blokini oching.

Hozircha `.env` da `http://localhost:5100` turibdi — **shu holicha prod'ga
chiqarilsa, har bir QR ishlamaydigan bo'lib bosiladi.**

## Tuzilma

| Domen | → | Port |
|---|---|---|
| `yurist.qrsystem.uz` | | `127.0.0.1:5101` |
| `admin.qrsystem.uz` | | `127.0.0.1:5102` |
| `rahbar.qrsystem.uz` | | `127.0.0.1:5103` |
| *(tanlanmagan)* | | `127.0.0.1:5100` |

`bright.qrsystem.uz` — mavjud qrcode-pro tizimi, alohida (Docker, :8090). Bu
config unga tegmaydi.

## O'rnatish

```bash
# 1. Kod
git clone <repo> /opt/spravka && cd /opt/spravka
npm ci
npm run db:generate && npm run db:push && npm run db:seed

# 2. Har bir app uchun .env (PORT ni ham yozing — systemd shundan oladi)
#    DATABASE_URL, AUTH_SECRET, NEXT_PUBLIC_PUBLIC_URL, PORT

# 3. Build
npm run build -w @spravka/web-yurist
npm run build -w @spravka/web-admin
npm run build -w @spravka/web-rahbar
npm run build -w @spravka/web-public

# 4. Servislar
useradd -r -s /usr/sbin/nologin spravka || true
chown -R spravka:spravka /opt/spravka
cp deploy/systemd/spravka@.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now spravka@yurist spravka@admin spravka@rahbar spravka@public

# 5. nginx — AVVAL faqat :80 (sertifikat hali yo'q)
cp deploy/nginx/snippets/spravka-proxy.conf /etc/nginx/snippets/
cp deploy/nginx/spravka-http.conf /etc/nginx/conf.d/
nginx -t && systemctl reload nginx

# 6. SSL (faqat 80-port ochilgandan keyin!)
bash deploy/setup-ssl.sh

# 7. Sertifikat olingach — endi :443
cp deploy/nginx/spravka-ssl.conf /etc/nginx/conf.d/
nginx -t && systemctl reload nginx
```

**5 va 7-qadam nega ajratilgan:** `spravka-ssl.conf` ichida
`/etc/letsencrypt/live/...` fayllari ko'rsatilgan. Ular yo'q bo'lsa nginx umuman
ko'tarilmaydi — demak certbot ham ishlay olmaydi, chunki u challenge'ni aynan
nginx orqali beradi. Klassik "tuxummi-tovuqmi". Shuning uchun avval :80,
keyin sertifikat, keyin :443.

## Tekshirish

```bash
systemctl status 'spravka@*'
ss -tlnp | grep 510          # faqat 127.0.0.1 da bo'lishi kerak, 0.0.0.0 da emas
certbot certificates
curl -I https://yurist.qrsystem.uz/
```

## Eslatmalar

- **HSTS ataylab yoqilmagan.** Sertifikat ishlashi tasdiqlanmaguncha qo'shmang:
  brauzer uni `max-age` davomida eslab qoladi va orqaga qaytarib bo'lmaydi.
- App'lar `127.0.0.1` ga bog'lanadi. `package.json` dagi `-H 0.0.0.0` faqat
  lokal dev uchun; prod'da systemd uni `-H 127.0.0.1` bilan almashtiradi, aks
  holda app'lar tashqi IP'da to'g'ridan-to'g'ri, TLS'siz ochiq qolardi.
- Sertifikat bitta — barcha nom SAN sifatida `/etc/letsencrypt/live/qrsystem.uz/`
  ichida. Yangi domen qo'shsangiz `setup-ssl.sh` ni qayta ishga tushiring.
- `certbot.timer` avtomatik yangilaydi; yangilanish ham 80-portni talab qiladi,
  shuning uchun `:80` bloki doim turishi kerak.

## DNS'da mayda kamchilik

Skrinshotda `www.bright.qrsystem.uz` **ikki marta**, aynan bir xil yozuv bilan
turibdi. Zarari yo'q, lekin bittasi ortiqcha — tozalab qo'ysa bo'ladi.
