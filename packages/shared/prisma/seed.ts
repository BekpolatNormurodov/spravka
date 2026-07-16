import { prisma } from '../src/db/index';
import { Role } from '../src/core/index';
import { hashPassword } from '../src/core/password';

/**
 * Real firms.
 *
 * Three sources, and where they disagree the .docx wins because it is the blank that actually
 * prints:
 *   • «Сухроб МКО лар бўйича маълумот.xlsx» — Наименование / Адрес / Директор / Бухгалтер / ИНН
 *   • «ММТ Реквизитлар.xlsx» — ИНН / БАНК / СЧЕТ / МФО for eight firms. Every one of them
 *     banks at ANORBANK, МФО 01183. The four accounts it shares with a .docx match digit for
 *     digit, which is why the other four are taken from it as-is.
 *   • the firms' own maʼlumotnoma .docx letterheads — name, address, ИНН, Х/р, МФО, bank,
 *     phone, Ижрочи, director position and the exact signature spelling.
 *
 * Four firms have a .docx (BRIGHT FUTURE, URBAN, COMMUNITY, FUNDFLOW) and are complete; the
 * rest still lack `phone`/`executorName`. PRESTIGE MOLIYA appears in no rekvizit sheet, so it
 * has no account. Nothing here is invented — the admin fills the gaps from the firm edit form.
 *
 * `directorName` is the short form the signature block prints, taken from the .docx blanks.
 * The Директор column of «ММТ Реквизитлар.xlsx» names a different person for five firms; it is
 * deliberately NOT applied here, because that name is what gets signed on a legal document.
 */
const TOSHKENT_GURUCHARIK = 'Тошкент шахри, Олмазор тумани Гуручарик МФЙ, Сагбон кучаси 30 берк, 7/1 уй';
const TOSHKENT_CHINNIOBOD = 'Тошкент шахри, Олмазор тумани, Чинниобод МФЙ, Чинниобод 2 мавзеси, 7 уй';
// Every .docx we have names the same executor and back-office number.
const EXECUTOR = { executorName: 'Б.Тоиров', executorPhone: '+99855-503-01-90', phone: '+99855-503-01-90' };
const ANORBANK = { mfo: '01183', bankName: 'АО "ANORBANK"' };

const FIRMS = [
  {
    id: 'firm_bright_future',
    name: '“BRIGHT FUTURE FINANCING MIKROMOLIYA TASHKILOTI” МЧЖ',
    letterheadName: '“BRIGHT FUTURE FINANCING MIKROMOLIYA TASHKILOTI” МЧЖ',
    shortName: 'BRIGHT FUTURE FINANCING',
    directorName: 'А.А.Бойназаров',
    directorFullName: 'BOYNAZAROV AKRAM ANVAROVICH',
    directorPosition: 'Ижрочи директори',
    accountantName: 'SHAKIROV ULUGʻBEK OYBEKOVICH',
    stir: '311976765',
    region: 'Toshkent',
    address: `${TOSHKENT_GURUCHARIK}.`,
    ...EXECUTOR,
    ...ANORBANK,
    bankAccount: '20216000207212842001',
  },
  {
    id: 'firm_urban_finance',
    name: '“URBAN FINANCE SOLUTIONS MIKROMOLIYA TASHKILOTI” МЧЖ',
    letterheadName: '«URBAN FINANCE SOLUTIONS MIKROMOLIYA TASHKILOTI» MCHJ',
    shortName: 'URBAN FINANCE SOLUTIONS',
    directorName: 'Ё.А.Хасанов',
    directorFullName: 'XASANOV YORQIN ALIYEVICH',
    directorPosition: 'Ижрочи директори',
    accountantName: 'XASANOV KOMIL QOBIL OʻGʻLI',
    stir: '311943592',
    // The blank prints a Toshkent/Chinniobod address; the spreadsheet's Адрес column says
    // Fargʻona. Kept verbatim from the blank — including its half-translated wording.
    region: 'Toshkent',
    address: 'Тошкент шаҳар, Олмазор тумани, Toshkent shahri, Olmazor tumani, Chinniobod MFY, Chinniobod-2 mavzesi, 7-uy.',
    ...EXECUTOR,
    ...ANORBANK,
    bankAccount: '20216000307206292001',
  },
  {
    id: 'firm_muvaffaqiyat',
    name: '“MUVAFFAQIYAT MIKROMOLIYA TASHKILOTI” МЧЖ',
    letterheadName: null,
    shortName: 'MUVAFFAQIYAT',
    directorName: 'Ж.К.Султанов',
    directorFullName: 'SULTANOV JOʻRABEK KAMOLDINOVICH',
    directorPosition: 'Ижрочи директори',
    accountantName: null,
    stir: '311939991',
    region: 'Toshkent',
    address: TOSHKENT_GURUCHARIK,
    ...ANORBANK,
    bankAccount: '20216000007205557001',
  },
  {
    id: 'firm_community',
    name: '«COMMUNITY MICROFINANCE MIKROMOLIYA TASHKILOTI» МЧЖ',
    letterheadName: '“COMMUNITY MICROFINANCE MIKROMOLIYA TASHKILOTI” MCHJ',
    shortName: 'COMMUNITY MICROFINANCE',
    // The blank signs with a single initial, not 'Д.Р.Мамадалиев'.
    directorName: 'Д.Мамадалиев',
    directorFullName: 'MAMADALIYEV DILSHOD RAHIMOVICH',
    directorPosition: 'Ижрочи директори',
    accountantName: 'TURAPOV DILSHOD ABDUKABILOVICH',
    stir: '312191604',
    // The blank prints Toshkent/Chinniobod; the spreadsheet's Адрес column says Andijon.
    region: 'Toshkent',
    address: 'Тошкент шахри, Олмазор тумани Чинниобод МФЙ, Чинниобод 2 мавзеси, 7 уй.',
    ...EXECUTOR,
    ...ANORBANK,
    bankAccount: '20216000307255890001',
  },
  {
    id: 'firm_fundflow',
    name: '«FUNDFLOW MIKROMOLIYA TASHKILOTI» МЧЖ',
    letterheadName: '«FUNDFLOW MIKROMOLIYA TASHKILOTI» MCHJ',
    shortName: 'FUNDFLOW',
    directorName: 'Ф.Ф.Сувонов',
    directorFullName: 'SUVONOV FARRUXJON FAXRIDDINOVICH',
    directorPosition: 'Ижрочи директори',
    accountantName: 'RIXSIBOYEV BAXODIR XASANOVICH',
    stir: '311979413',
    region: 'Toshkent',
    address: `${TOSHKENT_GURUCHARIK}.`,
    ...EXECUTOR,
    ...ANORBANK,
    bankAccount: '20216000307214276001',
  },
  {
    id: 'firm_dynamic_credit',
    name: '“DYNAMIC CREDIT SOLUTIONS MIKROMOLIYA TASHKILOTI” МЧЖ',
    letterheadName: null,
    shortName: 'DYNAMIC CREDIT SOLUTIONS',
    directorName: 'Д.Ш.Сулейманова',
    directorFullName: 'SULEYMANOVA DINARA SHAVKATOVNA',
    directorPosition: 'Ижрочи директори',
    accountantName: null,
    stir: '312192769',
    region: 'Toshkent',
    address: TOSHKENT_CHINNIOBOD,
    ...ANORBANK,
    bankAccount: '20216000007255899001',
  },
  {
    id: 'firm_darrowmad',
    name: '“DARROWMAD MIKROMOLIYA TASHKILOTI” МЧЖ',
    letterheadName: null,
    shortName: 'DARROWMAD',
    directorName: 'Р.Р.Камолдинов',
    directorFullName: 'KAMOLDINOV RUSTAMBEK ROʻZIBOY OʻGʻLI',
    directorPosition: 'Ижрочи директори',
    accountantName: null,
    stir: '312510309',
    region: 'Toshkent',
    address: TOSHKENT_CHINNIOBOD,
    ...ANORBANK,
    bankAccount: '20216000307331734001',
  },
  {
    id: 'firm_zaymly',
    name: '“ZAYMLY MIKROMOLIYA TASHKILOTI” МЧЖ',
    letterheadName: null,
    shortName: 'ZAYMLY',
    directorName: 'А.Р.Бозоров',
    directorFullName: 'BOZOROV ALISHER RAYIMBERDIYEVICH',
    directorPosition: 'Ижрочи директори',
    accountantName: 'MIRZAMADINOV ASRORJON ANVARJON OʻGʻLI',
    stir: '312500154',
    region: 'Toshkent',
    address: TOSHKENT_CHINNIOBOD,
    ...ANORBANK,
    bankAccount: '20216000407331685001',
  },
  {
    id: 'firm_prestige_moliya',
    name: '“PRESTIGE MOLIYA MIKROMOLIYA TASHKILOTI” МЧЖ',
    letterheadName: null,
    shortName: 'PRESTIGE MOLIYA',
    directorName: 'С.Т.Шералиев',
    directorFullName: 'SHERALIYEV SUXROB TAJIMATOVICH',
    directorPosition: 'Ижрочи директори',
    accountantName: null,
    stir: '312811527',
    region: 'Toshkent',
    address: TOSHKENT_CHINNIOBOD,
    // The one firm no rekvizit sheet covers: no account, no МФО. Ships archived so it stays
    // out of the firm pickers — a maʼlumotnoma printed on it would have an empty Х/р line.
    // Reactivate from Firmalar once the rekvizitlar are known.
    isActive: false,
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
