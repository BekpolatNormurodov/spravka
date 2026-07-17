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

DNS tarafi soz — **yettala nom ham** to'g'ri IP'ga hal bo'ladi (8.8.8.8 dan
tekshirildi, 2026-07-17):

```
qrsystem.uz              -> 213.230.64.140
www.qrsystem.uz          -> 213.230.64.140  (CNAME qrsystem.uz)
yurist.qrsystem.uz       -> 213.230.64.140  (CNAME qrsystem.uz)
admin.qrsystem.uz        -> 213.230.64.140  (CNAME qrsystem.uz)
rahbar.qrsystem.uz       -> 213.230.64.140  (CNAME qrsystem.uz)
bright.qrsystem.uz       -> 213.230.64.140
www.bright.qrsystem.uz   -> 213.230.64.140
```

Bu ro'yxat `setup-ssl.sh` dagi `DOMAINS` bilan **aynan bir xil bo'lishi shart**.
certbot har bir nom uchun alohida challenge oladi va bittasi javob bermasa —
**butun so'rovni rad etadi**, ya'ni yettalasi ham olinmaydi, faqat o'sha emas.

⚠️ Bu ro'yxat ilgari `www.qrsystem.uz` siz turgan edi va shu sababli u nginx'dan
ham, sertifikatdan ham chiqarib tashlangan edi. Yozuv DNS'da bor ekan — hujjat
eskirgan edi. **Nom haqidagi hujjatga ishonmang, nomni o'zini so'rang:**
`nslookup www.qrsystem.uz 8.8.8.8`.

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

| Domen | → | Port | App |
|---|---|---|---|
| `qrsystem.uz`, `www.qrsystem.uz` | | `127.0.0.1:5100` | web-public |
| `yurist.qrsystem.uz` | | `127.0.0.1:5101` | web-yurist |
| `admin.qrsystem.uz` | | `127.0.0.1:5102` | web-admin |
| `rahbar.qrsystem.uz` | | `127.0.0.1:5103` | web-rahbar |
| `bright.qrsystem.uz`, `www.bright...` | | `127.0.0.1:5000` | web-qr |

## ⚠️ `bright.qrsystem.uz` — bu ko'chirish, "tegmaydi" emas

Bu yerda ilgari "bright.qrsystem.uz — mavjud qrcode-pro, bu config unga
tegmaydi" deb yozilgan edi. **Bu noto'g'ri.** `spravka-ssl.conf` o'rnatilgan
lahzada `bright.qrsystem.uz` **spravka'ning o'z `web-qr` iga** (`:5000`)
o'tadi. Eski qrcode-pro (Docker, `:8090`) o'z-o'zicha ishlab turaveradi, lekin
tashqaridan unga hech kim kirmaydi.

Muhimi — **ular boshqa-boshqa bazada**:

| | Baza | Port |
|---|---|---|
| qrcode-pro | `qrcode_pro_db` | `3308` (Docker MySQL) |
| spravka web-qr | `spravka` | `3306` (native MySQL) |

Ya'ni ko'chirmasdan yo'naltirsangiz, **ilgari chop etilgan har bir QR 404
beradi** — yozuvlari eski bazada qolib ketadi. Chop etilgan QR'ni qaytarib
bo'lmaydi.

Yaxshi xabar: ikkala `QrCode` modeli **maydonma-maydon bir xil** (14 ustun,
bir xil tip va default, bir xil `@@index([type])`), `QrType` enum ham bir xil.
Demak to'g'ridan-to'g'ri dump/import ishlaydi:

```bash
# 1. Yozuvlar
docker exec qrcode-mysql mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" \
  --no-create-info --skip-triggers qrcode_pro_db QrCode > /tmp/qr.sql
mysql -uroot -p spravka < /tmp/qr.sql
shred -u /tmp/qr.sql          # parol bilan olingan dump — qoldirmang

# 2. Fayllar — yozuvlar ularsiz ma'nosiz: fileUrl/qrImageUrl diskka ishora qiladi
docker cp qrcode-nginx:/srv/qr/.      /opt/spravka/apps/web-qr/public/qr/
docker cp qrcode-nginx:/srv/uploads/. /opt/spravka/apps/web-qr/public/uploads/
chown -R spravka:spravka /opt/spravka/apps/web-qr/public

# 3. Tekshiring — eski QR'lardan bittasini oching, keyin eskisini o'chiring
```

Eski Docker'ni **darhol o'chirmang**: yangi tarafda eski QR ochilganini
ko'rmaguningizcha u — yagona nusxangiz.

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

## E-IMZO: «Режим разработчика» — nima uchun kerak va nimaga tushadi

**Holat.** E-IMZO ichida domenlar ro'yxati bor va u faqat `localhost` bilan
`127.0.0.1` dan iborat. Boshqa har qanday manzilga u imzo bermaydi:

```
status: -1022   «API-key для домена rahbar.qrsystem.uz недействителен»
```

Kod buni ataylab ajratib ko'rsatadi (`packages/shared/src/ui/eimzo.ts`):
`not-running` — rahbarning o'zi tuzatadi (dasturni yoqadi), `domain-denied` —
bu **bizning** muammomiz, dasturni qayta yoqish yordam bermaydi.

To'g'ri yechim — NIC'dan shu domen uchun API-KEY olish: **(71) 202-32-32**,
`info@yt.uz`. Kalit berilgunicha yagona yo'l — har bir rahbarning kompyuterida
E-IMZO sozlamalarida **«Режим разработчика»** ni yoqish. U domen tekshiruvini
o'chiradi va imzolash ishlaydi. Prod'da ham ishlayveradi.

### ⚠️ Lekin u tekshiruvni faqat biz uchun emas, HAMMA uchun o'chiradi

Bu belgi qo'yilgan paytda rahbarning kompyuterida ochilgan **istalgan sayt** —
reklama, phishing havola, tasodifiy sahifa — E-IMZO'ga murojaat qila oladi:

1. `list_all_certificates` — mashinadagi va fleshkadagi barcha kalitlarni
   sanab chiqadi: kim ekani, qanaqa ЭЦП borligi.
2. `load_key` — E-IMZO'ning **o'z parol oynasini** ochadi.

Gap shunda: **o'sha oyna kim so'raganini yozmaydi.** Rahbar aynan bizning
saytimizda ko'radigan oynaning o'zini ko'radi. Parolni tersa — hujumchi ochilgan
kalitni oladi va `create_pkcs7` bilan **o'zi xohlagan hujjatga** haqiqiy ЭЦП
qo'yadi. Rahbar o'sha hujjatni umuman ko'rmaydi.

Ya'ni xavf «sayt buziladi» emas — **rahbar nomidan soxta imzolangan hujjat**.

### Rahbarlarga aytilishi kerak bo'lgan gap

- Parolni **faqat** o'zingiz `rahbar.qrsystem.uz` da «Imzolash» ni bosgan
  zahoti tering. Oyna boshqa paytda chiqsa — **Bekor qiling** va xabar bering.
- **Fleshkani imzolamayotgan paytda sug'urib qo'ying.** Eng kuchli himoya shu:
  kalit yo'q bo'lsa, ochadigan narsa ham yo'q.
- API-KEY kelgach, «Режим разработчика» ni **o'chiring**. Vaqtinchalik chora,
  doimiy holat emas.

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
