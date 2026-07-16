import { prisma } from '../src/db/index';
import { Role } from '../src/core/index';
import { hashPassword } from '../src/core/password';

/**
 * Real firms, taken from «Сухроб МКО лар бўйича маълумот.xlsx».
 *
 * That sheet only carries Наименование / Адрес / Директор / Бухгалтер / ИНН, so `phone`,
 * `executorName` and the bank rekvizitlar are left empty for every firm except BRIGHT
 * FUTURE — those come from the source .docx letterhead and are the only ones we can vouch
 * for. Nothing here is invented; the admin fills the gaps from the firm edit form.
 *
 * `directorName` is the short form the signature block prints (verified against the .docx:
 * BOYNAZAROV AKRAM ANVAROVICH → А.А.Бойназаров); `directorFullName` keeps the register's
 * own spelling.
 */
const TOSHKENT_GURUCHARIK = 'Тошкент шахри, Олмазор тумани, Гуручарик МФЙ, Сагбон кучаси 30 берк, 7/1 уй';
const TOSHKENT_CHINNIOBOD = 'Тошкент шахри, Олмазор тумани, Чинниобод МФЙ, Чинниобод 2 мавзеси, 7 уй';

const FIRMS = [
  {
    id: 'firm_bright_future',
    name: '“BRIGHT FUTURE FINANCING MIKROMOLIYA TASHKILOTI” МЧЖ',
    shortName: 'BRIGHT FUTURE FINANCING',
    directorName: 'А.А.Бойназаров',
    directorFullName: 'BOYNAZAROV AKRAM ANVAROVICH',
    directorPosition: 'Ижрочи директори',
    accountantName: 'SHAKIROV ULUGʻBEK OYBEKOVICH',
    stir: '311976765',
    region: 'Toshkent',
    address: `${TOSHKENT_GURUCHARIK}.`,
    // Only this firm's letterhead is documented (word/header1.xml of the source .docx).
    executorName: 'Б.Тоиров',
    executorPhone: '+99855-503-01-90',
    phone: '+99855-503-01-90',
    bankAccount: '20216000207212842001',
    mfo: '01183',
    bankName: 'АО "ANORBANK"',
  },
  {
    id: 'firm_urban_finance',
    name: '“URBAN FINANCE SOLUTIONS MIKROMOLIYA TASHKILOTI” МЧЖ',
    shortName: 'URBAN FINANCE SOLUTIONS',
    directorName: 'Ё.А.Хасанов',
    directorFullName: 'XASANOV YORQIN ALIYEVICH',
    directorPosition: 'Директори',
    accountantName: 'XASANOV KOMIL QOBIL OʻGʻLI',
    stir: '311943592',
    region: 'Fargʻona',
    address: 'Фарғона вилояти, Фарғона шахар, Навруз МФЙ, Университет кучаси 24/4',
  },
  {
    id: 'firm_muvaffaqiyat',
    name: '“MUVAFFAQIYAT MIKROMOLIYA TASHKILOTI” МЧЖ',
    shortName: 'MUVAFFAQIYAT',
    directorName: 'Ж.К.Султанов',
    directorFullName: 'SULTANOV JOʻRABEK KAMOLDINOVICH',
    directorPosition: 'Директори',
    accountantName: null,
    stir: '311939991',
    region: 'Toshkent',
    address: TOSHKENT_GURUCHARIK,
  },
  {
    id: 'firm_community',
    name: '“COMMUNITY MICROFINANCE MIKROMOLIYA TASHKILOTI” МЧЖ',
    shortName: 'COMMUNITY MICROFINANCE',
    directorName: 'Д.Р.Мамадалиев',
    directorFullName: 'MAMADALIYEV DILSHOD RAHIMOVICH',
    directorPosition: 'Директори',
    accountantName: 'TURAPOV DILSHOD ABDUKABILOVICH',
    stir: '312191604',
    region: 'Andijon',
    address: 'Андижон вилояти, Андижон шахар, Бобуршох кучаси 20/г',
  },
  {
    id: 'firm_fundflow',
    name: '“FUNDFLOW MIKROMOLIYA TASHKILOTI” МЧЖ',
    shortName: 'FUNDFLOW',
    directorName: 'Ф.Ф.Сувонов',
    directorFullName: 'SUVONOV FARRUXJON FAXRIDDINOVICH',
    directorPosition: 'Директори',
    accountantName: 'RIXSIBOYEV BAXODIR XASANOVICH',
    stir: '311979413',
    region: 'Toshkent',
    address: TOSHKENT_GURUCHARIK,
  },
  {
    id: 'firm_dynamic_credit',
    name: '“DYNAMIC CREDIT SOLUTIONS MIKROMOLIYA TASHKILOTI” МЧЖ',
    shortName: 'DYNAMIC CREDIT SOLUTIONS',
    directorName: 'Д.Ш.Сулейманова',
    directorFullName: 'SULEYMANOVA DINARA SHAVKATOVNA',
    directorPosition: 'Директори',
    accountantName: null,
    stir: '312192769',
    region: 'Toshkent',
    address: TOSHKENT_CHINNIOBOD,
  },
  {
    id: 'firm_darrowmad',
    name: '“DARROWMAD MIKROMOLIYA TASHKILOTI” МЧЖ',
    shortName: 'DARROWMAD',
    directorName: 'Р.Р.Камолдинов',
    directorFullName: 'KAMOLDINOV RUSTAMBEK ROʻZIBOY OʻGʻLI',
    directorPosition: 'Директори',
    accountantName: null,
    stir: '312510309',
    region: 'Toshkent',
    address: TOSHKENT_CHINNIOBOD,
  },
  {
    id: 'firm_zaymly',
    name: '“ZAYMLY MIKROMOLIYA TASHKILOTI” МЧЖ',
    shortName: 'ZAYMLY',
    directorName: 'А.Р.Бозоров',
    directorFullName: 'BOZOROV ALISHER RAYIMBERDIYEVICH',
    directorPosition: 'Директори',
    accountantName: 'MIRZAMADINOV ASRORJON ANVARJON OʻGʻLI',
    stir: '312500154',
    region: 'Toshkent',
    address: TOSHKENT_CHINNIOBOD,
  },
  {
    id: 'firm_prestige_moliya',
    name: '“PRESTIGE MOLIYA MIKROMOLIYA TASHKILOTI” МЧЖ',
    shortName: 'PRESTIGE MOLIYA',
    directorName: 'С.Т.Шералиев',
    directorFullName: 'SHERALIYEV SUXROB TAJIMATOVICH',
    directorPosition: 'Директори',
    accountantName: null,
    stir: '312811527',
    region: 'Toshkent',
    address: TOSHKENT_CHINNIOBOD,
  },
];

async function main() {
  for (const f of FIRMS) {
    await prisma.firm.upsert({ where: { id: f.id }, update: f, create: f });
  }

  // Drop the placeholder firms this seed used to create. Anything that already carries
  // maʼlumotnoma rows is archived instead of deleted — an issued document must keep its firm.
  const stale = await prisma.firm.findMany({
    where: { id: { notIn: FIRMS.map((f) => f.id) } },
    select: { id: true, _count: { select: { certificates: true } } },
  });
  for (const s of stale) {
    if (s._count.certificates > 0) {
      await prisma.firm.update({ where: { id: s.id }, data: { isActive: false } });
    } else {
      await prisma.user.updateMany({ where: { firmId: s.id }, data: { firmId: null } });
      await prisma.firm.delete({ where: { id: s.id } });
    }
  }

  const pass = await hashPassword('parol123');
  const users = [
    { login: 'yurist', fullName: 'Yurist Foydalanuvchi', role: Role.YURIST, position: 'Yurist' },
    { login: 'admin', fullName: 'Admin Foydalanuvchi', role: Role.ADMIN, position: 'Administrator' },
    // A RAHBAR is a firm's ijrochi direktor — must be attached to exactly one firm.
    { login: 'rahbar', fullName: 'Rahbar Foydalanuvchi', role: Role.RAHBAR, position: 'Ijrochi direktor', firmId: 'firm_bright_future' },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { login: u.login },
      update: { fullName: u.fullName, role: u.role, position: u.position, firmId: (u as { firmId?: string }).firmId ?? null },
      create: { ...u, passwordHash: pass, plainPassword: 'parol123' },
    });
  }

  console.log('Seed complete: %d firms, %d users, %d stale firms handled', FIRMS.length, users.length, stale.length);
}

main().finally(() => prisma.$disconnect());
