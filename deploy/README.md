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
NEXT_PUBLIC_PUBLIC_URL=https://qrsystem.uz    # ildizdagi bitta .env — compose uni
                                              # build ARGUMENTI sifatida uzatadi
```

⚠️ **Avval `:5000` (web-qr) turgan edi — o'sha appda `/m/` marshruti umuman
yo'q.** O'sha qiymat bilan chiqarilgan har bir QR 404 ga olib boradi. Prod'ga
chiqishdan oldin `.env` ni tekshiring, va agar shu holatda hujjat chiqarilgan
bo'lsa — ularning QR'i tuzalmaydi.

## Tuzilma — 4 ta app, qrcode alohida

| Domen | → | Port | Nima |
|---|---|---|---|
| `qrsystem.uz`, `www.qrsystem.uz` | | `127.0.0.1:5100` | spravka **public** |
| `yurist.qrsystem.uz` | | `127.0.0.1:5101` | spravka **yurist** |
| `admin.qrsystem.uz` | | `127.0.0.1:5102` | spravka **admin** |
| `rahbar.qrsystem.uz` | | `127.0.0.1:5103` | spravka **rahbar** |
| `bright.qrsystem.uz`, `www.bright...` | | `127.0.0.1:8090` | **qrcode-pro — bizniki emas** |

Ikkala tizim bir serverda, lekin **hech nimani baham ko'rmaydi**:

| | Compose | Baza | Port |
|---|---|---|---|
| qrcode-pro | o'zining | `qrcode_pro_db` | nginx 8090, mysql 3308 |
| spravka | `docker-compose.yml` | `spravka` (volume) | 5100–5103, mysql ochilmagan |

`bright.qrsystem.uz` uchun biz **faqat TLS qo'shamiz**: host nginx sertifikatni
yechib, qrcode-pro'ning o'z nginx'iga (`127.0.0.1:8090`) uzatadi. Kodiga ham,
bazasiga ham, fayllariga ham tegilmaydi. Eski QR'lar ishlayveradi.

> Monorepoda `web-qr` bor va bir vaqt `bright` o'shanga qaratilgan edi. U —
> **bo'sh bazaga ko'chirish** bo'lardi: hozirgacha chop etilgan har bir QR 404
> berardi. Deploy qilinmaydi. Nomni qrcode-pro saqlaydi, ma'lumoti bilan birga.

## Skriptlar

Uchtasi, ataylab alohida — har biri boshqa narsani kutadi:

| Skript | Qachon | Nima kutadi |
|---|---|---|
| `deploy/init.sh` | bir marta | Docker |
| `deploy/setup-ssl.sh` | :80 ochilgach | **FortiGate** |
| `deploy/update.sh` | har yangilanishda | init.sh o'tgan |

Birlashtirsak, hammasi FortiGate'ni kutib qolardi.

```bash
# O'rnatish (bir marta)
git clone https://github.com/BekpolatNormurodov/spravka.git /opt/spravka
cd /opt/spravka
bash deploy/init.sh

# Yangilash (har safar)
cd /opt/spravka && bash deploy/update.sh
```

`init.sh` — `.env` ni o'zi yozadi va parollarni generatsiya qiladi
(`MYSQL_ROOT_PASSWORD`, `AUTH_SECRET`, `SEED_PASSWORD`). Mavjud `.env` ustidan
**yozmaydi**, qayta yurgizish xavfsiz. Ishga tushishida qrcode-pro
konteynerlarini sanab ko'rsatadi — "tegilmadi" deb aytish uchun.

`update.sh` — `git pull` → `docker compose build` → `db push` → `up -d`, keyin
har bir portga **so'rov yuborib** tekshiradi. Konteyner "up" bo'lishi sog'liq
emas: Next portni darhol qabul qiladi, keyin birinchi so'rovda yiqilishi mumkin.
**Har qanday xatoda** eski image'ga qaytaradi (`spravka:previous`) — shuning
uchun build'dan oldin eski image teglab qo'yiladi, aks holda `latest` ustidan
yozilib, qaytadigan joy qolmasdi.

Serverda commit qilinmagan o'zgarish bo'lsa — **ishlamaydi**, uni yo'q qilib
yubormaydi.

## `docker compose` — kundalik

```bash
docker compose ps                    # holat
docker compose logs -f rahbar        # loglar
docker compose restart rahbar        # bitta app
docker compose up -d --build         # qayta build (NEXT_PUBLIC_* o'zgarsa SHART)
```

⚠️ `NEXT_PUBLIC_PUBLIC_URL` ni `.env` da o'zgartirib **restart qilish hech
narsa bermaydi** — u `next build` da kodga inline bo'ladi, ya'ni `--build` kerak.

## Eski, systemd varianti

`deploy/systemd/spravka@.service` — Docker'gacha bo'lgan yo'l. Serverda Docker
ishlatilyapti, bu fayl faqat ma'lumot uchun qoldirilgan.

## `.env` — bitta fayl, `docker-compose.yml` yonida

`.env.docker.example` dan nusxa; `init.sh` uni o'zi yaratib, parollarni
generatsiya qiladi. Qo'lda to'ldirsangiz — mana to'rttasi:

| O'zgaruvchi | Qayerda | Qo'yilmasa |
|---|---|---|
| `MYSQL_ROOT_PASSWORD` | mysql + `DATABASE_URL` | compose ko'tarilmaydi |
| `AUTH_SECRET` | to'rtala app | prod'da **ishga tushmaydi** — ataylab |
| `NEXT_PUBLIC_PUBLIC_URL` | **build argumenti** | prod'da **rad etiladi** — ataylab |
| `SEED_PASSWORD` | faqat `db:seed` | prod'da **seed ishlamaydi** — ataylab |

`DATABASE_URL`, `PORT`, `CERT_STORAGE_DIR` jadvalda yo'q — ular
`docker-compose.yml` ichida. Qo'lda qo'yiladigan joyi yo'q, ya'ni unutib
bo'lmaydi. Ilgari `PORT` unutilsa systemd `-p` ni bo'sh berib, app 502 ortida
aylanaverardi; Docker'da bu xato butunlay yo'q bo'ldi.

**`AUTH_SECRET` to'rtalasida bir xil bo'lishi shart** — biri qo'ygan sessiya
cookie'si boshqasida tekshiriladi. `env_file` hammasiga bir xilini beradi.

**`NEXT_PUBLIC_PUBLIC_URL` — build argumenti, runtime emas.** `next build` uni
kodga inline qiladi. `.env` da o'zgartirib `restart` qilsangiz **hech narsa
o'zgarmaydi** — `docker compose up -d --build` kerak. Noto'g'ri qiymat bilan
chiqarilgan hujjatlarning QR'i esa **abadiy noto'g'ri**: PDF muzlatilgan va
qayta chop etib bo'lmaydi.

**nginx nega ikki bosqichda:** `spravka-ssl.conf` ichida
`/etc/letsencrypt/live/...` fayllari ko'rsatilgan. Ular yo'q bo'lsa nginx umuman
ko'tarilmaydi — demak certbot ham ishlay olmaydi, chunki u challenge'ni aynan
nginx orqali beradi. Klassik "tuxummi-tovuqmi": avval `:80`, keyin sertifikat,
keyin `:443`.

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
docker compose ps                          # to'rtala app + mysql
docker ps | grep qrcode-                   # eskisi ham tirikligini ko'ring
ss -tlnp | grep -E '510[0-3]'              # faqat 127.0.0.1 da bo'lishi kerak
certbot certificates
curl -I https://yurist.qrsystem.uz/
curl -I https://bright.qrsystem.uz/        # bu qrcode-pro, :8090 orqali
```

## ⚠️ Backup: hujjatlar ombori — bazadan kam emas

`cert_storage` volume ichidagi PDF'lar — **berilgan huquqiy hujjatlar**, kesh
emas. Rahbar imzolagan lahzada fayl muzlatiladi va boshqa hech qachon
o'zgarmaydi; QR orqali kelgan odam aynan shuni yuklab oladi.

Fayl yo'qolsa "qayta chizamiz" ish bermaydi. Tizim uni `firmSnapshot`'dan qayta
chiza oladi, lekin bu **boshqa fayl** bo'ladi — boshqa baytlar, boshqa
`pdfSha256`. Ya'ni odam qo'lidagi qog'oz bilan bazadagi yozuv o'rtasidagi
bog'lanish uziladi.

Ikkovi **bir vaqtda, bir joyga** tushishi kerak — bir-birisiz to'liq emas:

```bash
docker compose exec -T mysql mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" spravka > db.sql
docker run --rm -v spravka_cert_storage:/s -v "$PWD":/b alpine tar czf /b/storage.tgz -C /s .
```

Volume nomi `<papka>_cert_storage` — `/opt/spravka` da bo'lsangiz
`spravka_cert_storage`. Aniq nomi: `docker volume ls`.

## Eslatmalar

- **HSTS ataylab yoqilmagan.** Sertifikat ishlashi tasdiqlanmaguncha qo'shmang:
  brauzer uni `max-age` davomida eslab qoladi va orqaga qaytarib bo'lmaydi.
- Konteynerlar ichida app'lar `0.0.0.0` ga bog'lanadi — bu konteynerning **o'z**
  tarmog'i. Tashqariga chiqmasligini compose'dagi `127.0.0.1:5100:5100` ta'minlaydi.
  Bu muhim: Docker o'z iptables qoidalarini yozadi va `ufw` ni aylanib o'tadi, ya'ni
  `host_ip` siz yozilgan port firewall yoqilgan holda ham LAN'ga ochiq bo'lardi.
- MySQL umuman port ochmaydi — unga faqat compose tarmog'idan kiriladi.
- Sertifikat bitta — barcha nom SAN sifatida `/etc/letsencrypt/live/qrsystem.uz/`
  ichida. Yangi domen qo'shsangiz `setup-ssl.sh` ni qayta ishga tushiring.
- `certbot.timer` avtomatik yangilaydi; yangilanish ham 80-portni talab qiladi,
  shuning uchun `:80` bloki doim turishi kerak.

## DNS'da mayda kamchilik

Skrinshotda `www.bright.qrsystem.uz` **ikki marta**, aynan bir xil yozuv bilan
turibdi. Zarari yo'q, lekin bittasi ortiqcha — tozalab qo'ysa bo'ladi.
