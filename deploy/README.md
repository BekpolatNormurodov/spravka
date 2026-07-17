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

## Public domen: `qrsystem.uz` → web-public (:5100)

`web-public` (:5100) — bu **chop etilgan QR ochadigan sahifa**, `/m/<id>`. Unga
apex domen — `qrsystem.uz` — ajratildi: QR uchun eng qisqa va eng barqaror nom,
DNS'da allaqachon IP'ga hal bo'ladi.

**Bu qiymat build paytida kodga qotib qoladi.** Next `NEXT_PUBLIC_*` ni
`next build` da inline qiladi. Ya'ni:

- `.env` **build'dan oldin** to'g'ri bo'lishi shart;
- `.env` ni keyin o'zgartirish **hech narsani o'zgartirmaydi** — qayta build kerak;
- noto'g'ri qiymat bilan chiqarilgan hujjatlarning QR'i **abadiy noto'g'ri**
  qoladi, chunki PDF muzlatilgan va qayta chop etib bo'lmaydi.

```bash
NEXT_PUBLIC_PUBLIC_URL="https://qrsystem.uz"   # har bir app'ning .env'ida
```

⚠️ **Avval `:5000` (web-qr) turgan edi — o'sha appda `/m/` marshruti umuman
yo'q.** O'sha qiymat bilan chiqarilgan har bir QR 404 ga olib boradi. Prod'ga
chiqishdan oldin `.env` ni tekshiring, va agar shu holatda hujjat chiqarilgan
bo'lsa — ularning QR'i tuzalmaydi.

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
# 1. Kod va Node
git clone <repo> /opt/spravka && cd /opt/spravka
node -v   # >= 22 kerak. nvm bilan o'rnatmang: systemd'da ProtectHome=true, $HOME ko'rinmaydi.
          # apt/nodesource orqali o'rnating — binar /usr/bin da bo'lsin.

# Chromium — imzolashda hujjatni PDF qiladi. Kutubxonalarini apt bilan qo'lda
# sanamaymiz: Ubuntu 24.04 ularning yarmini t64 qo'shimchasi bilan qayta nomlagan
# (libasound2 -> libasound2t64 va h.k.), va apt bitta noto'g'ri nom uchun
# HECH NARSA o'rnatmaydi. Puppeteer o'zining ro'yxatini biladi.
export PUPPETEER_CACHE_DIR=/opt/spravka/.cache/puppeteer   # $HOME'da emas — ProtectHome
npm ci
npx puppeteer browsers install chrome --install-deps

# 2. ROOT .env — db:push shundan DATABASE_URL ni oladi, ya'ni bazadan OLDIN.
#    .env.example dan nusxa olsangiz, DATABASE_URL portini almashtiring:
#    3310 — bu docker'dagi dev bazasi. Serverda native MySQL, ya'ni 3306.
cp .env.example .env && nano .env

# 3. Baza
npm run db:generate && npm run db:push && npm run db:seed

# 4. Har bir app uchun .env — quyidagi jadvalga qarang. NEXT_PUBLIC_* ni
#    BUILD'DAN OLDIN to'g'ri qo'ying, u kodga qotib qoladi.

# 4b. Imzolangan hujjatlar ombori (CERT_STORAGE_DIR)
mkdir -p /var/lib/spravka/storage
chown -R spravka:spravka /var/lib/spravka

# 4c. web-qr runtime'da shu ikkisiga yozadi (systemd'da ReadWritePaths ochilgan)
mkdir -p /opt/spravka/apps/web-qr/public/uploads /opt/spravka/apps/web-qr/public/qr

# 5. Build — beshalasi ham
npm run build -w @spravka/web-qr
npm run build -w @spravka/web-yurist
npm run build -w @spravka/web-admin
npm run build -w @spravka/web-rahbar
npm run build -w @spravka/web-public

# 6. Servislar
useradd -r -s /usr/sbin/nologin spravka || true
chown -R spravka:spravka /opt/spravka
cp deploy/systemd/spravka@.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now spravka@public spravka@yurist spravka@admin spravka@rahbar spravka@qr

# 7. nginx — AVVAL faqat :80 (sertifikat hali yo'q)
cp deploy/nginx/snippets/spravka-proxy.conf /etc/nginx/snippets/
cp deploy/nginx/spravka-http.conf /etc/nginx/conf.d/
nginx -t && systemctl reload nginx

# 8. SSL (faqat 80-port ochilgandan keyin!)
bash deploy/setup-ssl.sh

# 9. Sertifikat olingach — endi :443
cp deploy/nginx/spravka-ssl.conf /etc/nginx/conf.d/
nginx -t && systemctl reload nginx
```

## Har bir app uchun `.env`

Kod **sakkizta** o'zgaruvchi o'qiydi. Quyidagi jadval — yagona to'liq ro'yxat.

| O'zgaruvchi | Kimga | Prod qiymati | Qo'yilmasa |
|---|---|---|---|
| `DATABASE_URL` | hammasi | `mysql://user:pass@localhost:3306/spravka` | Prisma yiqiladi (**baland**) |
| `AUTH_SECRET` | hammasi | `openssl rand -base64 48` | prod'da **ishga tushmaydi** — ataylab |
| `PORT` | hammasi | qr 5000 · public 5100 · yurist 5101 · admin 5102 · rahbar 5103 | systemd `-p` ni bo'sh beradi → **crash loop → 502** |
| `CERT_STORAGE_DIR` | rahbar, public, admin | `/var/lib/spravka/storage` | imzolashda yiqiladi (**baland**) |
| `NEXT_PUBLIC_PUBLIC_URL` | rahbar, public, yurist, admin | `https://qrsystem.uz` | prod'da **rad etiladi** — ataylab |
| `NEXT_PUBLIC_APP_URL` | **qr** | `https://bright.qrsystem.uz` | prod'da **rad etiladi** — ataylab |
| `ADMIN_USERNAME` | **qr** | (tanlaysiz) | login **jimgina** har doim rad etadi |
| `ADMIN_PASSWORD` | **qr** | (tanlaysiz) | login **jimgina** har doim rad etadi |

Oxirgi uchtasi faqat **web-qr** ga tegishli va ilgari bu ro'yxatda umuman yo'q edi.
`ADMIN_USERNAME`/`ADMIN_PASSWORD` **jimgina** yiqiladi: `bright.qrsystem.uz` har
qanday to'g'ri parolga ham "parol xato" deydi va logda hech narsa qolmaydi.

`AUTH_SECRET` da `#` yoki `$` bo'lmasin — systemd'ning `EnvironmentFile` parseri
dotenv emas, ularni boshqacha o'qiydi. `openssl rand -base64 48` xavfsiz.

**7 va 9-qadam nega ajratilgan:** `spravka-ssl.conf` ichida
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

## ⚠️ Backup: `/var/lib/spravka/storage` — bazadan kam emas

Bu papkadagi PDF'lar — **berilgan huquqiy hujjatlar**, kesh emas. Rahbar imzolagan
lahzada fayl muzlatiladi va boshqa hech qachon o'zgarmaydi; QR orqali kelgan odam
aynan shuni yuklab oladi.

Fayl yo'qolsa "qayta chizamiz" ish bermaydi. Tizim uni `firmSnapshot`'dan qayta
chiza oladi, lekin bu **boshqa fayl** bo'ladi — boshqa baytlar, boshqa `pdfSha256`.
Ya'ni odam qo'lidagi qog'oz bilan bazadagi yozuv o'rtasidagi bog'lanish uziladi.

DB backup nimaga tushsa, `/var/lib/spravka/storage` ham **o'sha joyga, o'sha
jadvalda** tushishi kerak. Ikkovi bir-birisiz to'liq emas.

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
