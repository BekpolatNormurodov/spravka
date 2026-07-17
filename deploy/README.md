# Spravka — deploy (Docker + nginx + certbot)

Yangi serverga o'rnatiladi. `qrcode-pro` eski serverda (`213.230.64.140`) qoladi
— bazasi, fayllari, `bright.qrsystem.uz` domeni bilan birga. Ikki tizim endi
ikki mashinada: umumiy port ham, baza ham, volume ham yo'q.

## ⛔ Avval: DNS yangi serverga qaratilsin

`setup-ssl.sh` beshta nom uchun sertifikat so'raydi. certbot har biri uchun
`:80` ga so'rov yuboradi — **bitta nom javob bermasa, butun so'rov rad etiladi**,
ya'ni beshtasi ham olinmaydi.

Shuning uchun sertifikatdan **oldin** bu beshtasi yangi serverning IP'siga hal
bo'lishi shart:

```
qrsystem.uz              A     <yangi-server-IP>
www.qrsystem.uz          CNAME qrsystem.uz
yurist.qrsystem.uz       CNAME qrsystem.uz
admin.qrsystem.uz        CNAME qrsystem.uz
rahbar.qrsystem.uz       CNAME qrsystem.uz
```

`bright.qrsystem.uz` — **tegmang.** U eski serverga ishora qilib turaveradi;
qrcode o'sha yerda ishlaydi. Aynan shuning uchun u `DOMAINS` ro'yxatida ham,
nginx configda ham yo'q: uni qo'shsak, u eski IP'ga hal bo'lardi, javob
bermasdi va **qolgan to'rttasining sertifikatini ham yiqitardi**.

Tekshirish (skript ham buni o'zi qiladi, certbot chaqirilishidan oldin):

```bash
for d in qrsystem.uz www.qrsystem.uz yurist.qrsystem.uz admin.qrsystem.uz rahbar.qrsystem.uz; do
  echo "$d -> $(dig +short "$d" | tail -1)"
done
```

## ⛔ Va: 80/443 tashqaridan ochiq bo'lsin

HTTP-01 challenge Let's Encrypt'ning `:80` ga **tashqaridan** ulanishini talab
qiladi. Eski serverda bu yopiq edi (FortiGate `:443` ni o'zi ushlab turardi,
`:80` umuman forward qilinmagandi) va sertifikat shu sababli olinmagandi.

Yangi serverda buni oldindan tekshiring:

```bash
ss -tlnp | grep -E ':80|:443'    # nginx tinglayaptimi
curl -I http://<yangi-IP>/       # TASHQI tarmoqdan
ufw status
```

Yopiq bo'lsa `setup-ssl.sh` o'zi to'xtaydi va qaysi nom yiqilganini aytadi —
certbot chaqirilmaydi. Bu ataylab: Let's Encrypt haftasiga 5 ta dublikatga
ruxsat beradi va limitni yoqib yuborsangiz kunlab kutasiz.

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

**Yangi serverda** — 4 ta app, hammasi Docker'da:

| Domen | → | Port | Nima |
|---|---|---|---|
| `qrsystem.uz`, `www.qrsystem.uz` | | `127.0.0.1:5100` | spravka **public** |
| `yurist.qrsystem.uz` | | `127.0.0.1:5101` | spravka **yurist** |
| `admin.qrsystem.uz` | | `127.0.0.1:5102` | spravka **admin** |
| `rahbar.qrsystem.uz` | | `127.0.0.1:5103` | spravka **rahbar** |

**Eski serverda** — tegilmaydi:

| Domen | → | Nima |
|---|---|---|
| `bright.qrsystem.uz` | `213.230.64.140` | qrcode-pro, o'z Docker'i, o'z `qrcode_pro_db` bazasi |

Ikki mashina, ikki baza, umumiy hech narsa yo'q. `bright` DNS'da eski IP'da
qoladi va bu configlarga umuman kirmaydi.

> Monorepoda `web-qr` bor va bir vaqt `bright` o'shanga qaratilgan edi. U —
> **bo'sh bazaga ko'chirish** bo'lardi: hozirgacha chop etilgan har bir QR 404
> berardi. Deploy qilinmaydi, `docker-compose.yml` da yo'q. Nomni qrcode-pro
> saqlaydi, ma'lumoti bilan birga.
>
> Agar keyinchalik qrcode ham shu serverga ko'chsa: DNS'ni burib, `bright` ni
> `setup-ssl.sh` dagi `DOMAINS` ga qo'shing va sertifikatni qayta oling. Undan
> oldin emas — nom eski IP'ga hal bo'lib turganda uni so'rash **qolgan
> to'rttasining sertifikatini ham yiqitadi**.

## Skriptlar

Uchtasi, ataylab alohida — har biri boshqa narsani kutadi:

| Skript | Qachon | Nima kutadi |
|---|---|---|
| `deploy/init.sh` | bir marta | Docker |
| `deploy/setup-ssl.sh` | DNS burilib, :80 ochilgach | **DNS + tarmoq** |
| `deploy/update.sh` | har yangilanishda | init.sh o'tgan |

Birlashtirsak, app'larni ko'tarish ham DNS'ni kutib qolardi. Ular alohida
bo'lgani uchun `init.sh` ni hoziroq yurgizib, tizimni `127.0.0.1` da sinab
ko'rsangiz bo'ladi — sertifikat keyin keladi.

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
ss -tlnp | grep -E '510[0-3]'              # faqat 127.0.0.1 da bo'lishi kerak
certbot certificates
curl -I https://yurist.qrsystem.uz/
curl -I https://qrsystem.uz/               # QR shu yerga tushadi
```

`bright.qrsystem.uz` bu serverda emas — u eski mashinada, o'z Docker'ida.

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
