import { randomBytes } from 'node:crypto';
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

/**
 * Who gets a rahbar account, in the order they are printed.
 *
 * A firm may appear more than once. `Certificate.firmId` is what scopes a rahbar, and nothing
 * requires that scope to belong to one person — two directors at one firm both sign that firm's
 * documents, and each signature records which of them it was. Name a firm twice and the logins
 * come out `bright_future` and `bright_future2`.
 */
const RAHBAR_FIRMS: string[] = [
  'firm_bright_future',
  'firm_urban_finance',
  'firm_muvaffaqiyat',
  'firm_community',
  'firm_fundflow',
  'firm_dynamic_credit',
  'firm_darrowmad',
  'firm_zaymly',
  'firm_prestige_moliya',
];

/** No O/0 and no l/1/I: these are read off a screen and retyped by someone else. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function randomChars(n: number): string {
  const bytes = randomBytes(n);
  let out = '';
  for (let i = 0; i < n; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

/**
 * A password that says which firm it belongs to and is still random enough to be one.
 *
 * The marker is not a secret and is not meant to be: these get copied into a message and sent to
 * nine different people, and a password found later with no idea whose it was is a password
 * nobody dares change. The eight characters after it carry the strength.
 */
function newPassword(marker: string): string {
  return `${marker}-${randomChars(8)}`;
}

/** '«BRIGHT FUTURE FINANCING» МЧЖ' -> 'Bright'. The first word is what people call the firm. */
function markerFor(name: string): string {
  const word = name.trim().split(/[\s"«»']+/).filter(Boolean)[0] ?? 'Firma';
  const latin = word.replace(/[^A-Za-z]/g, '') || 'Firma';
  return latin[0]!.toUpperCase() + latin.slice(1).toLowerCase();
}

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

  /*
    One rahbar per firm, named after the person who actually signs there.

    A RAHBAR is a firm's ijrochi direktor and acts only on that firm's documents — the scoping is
    already enforced in web-rahbar/src/lib/scope.ts, which reads the firm from the user row on
    every request. What was missing was the accounts: a single shared `rahbar` login stood for all
    nine firms, so whoever held it signed for all of them and the signature said nothing about who.
  */
  const byId = new Map(FIRMS.map((f) => [f.id, f]));

  // Login per firm, numbered from the second one on: bright_future, bright_future2.
  const seen = new Map<string, number>();
  const wanted = [
    { login: 'yurist', fullName: 'Yurist', role: Role.YURIST, position: 'Yurist', firmId: null as string | null, marker: 'Yurist' },
    { login: 'admin', fullName: 'Administrator', role: Role.ADMIN, position: 'Administrator', firmId: null as string | null, marker: 'Admin' },
    ...RAHBAR_FIRMS.map((firmId) => {
      const firm = byId.get(firmId);
      if (!firm) throw new Error(`RAHBAR_FIRMS names a firm that is not in FIRMS: ${firmId}`);
      const slug = firmId.replace(/^firm_/, '');
      const n = (seen.get(slug) ?? 0) + 1;
      seen.set(slug, n);
      return {
        login: n === 1 ? slug : `${slug}${n}`,
        fullName: firm.directorFullName ?? firm.directorName,
        role: Role.RAHBAR,
        position: firm.directorPosition ?? 'Ижрочи директори',
        firmId,
        marker: markerFor(firm.shortName ?? firm.name),
      };
    }),
  ];

  /*
    Clear out whoever is not on the list — the old shared `rahbar` account among them.

    A user a maʼlumotnoma points at is deactivated rather than deleted:
    `Certificate.createdById`, `Certificate.signedById` and `WorkflowEvent.actorId` all reference
    User, and that reference is the record of who wrote and who signed a legal document. The
    database would refuse the delete anyway.
  */
  const others = await prisma.user.findMany({
    where: { login: { notIn: wanted.map((w) => w.login) } },
    select: { id: true, login: true, _count: { select: { createdCerts: true, signedCerts: true, events: true } } },
  });
  let deleted = 0;
  const deactivated: string[] = [];
  for (const u of others) {
    if (u._count.createdCerts + u._count.signedCerts + u._count.events > 0) {
      await prisma.user.update({ where: { id: u.id }, data: { isActive: false } });
      deactivated.push(u.login);
    } else {
      await prisma.user.delete({ where: { id: u.id } });
      deleted++;
    }
  }

  /*
    An existing account keeps its password unless RESET_PASSWORDS=1 is asked for.

    Seeding is routine — deploy/init.sh runs it — and quietly reissuing credentials people are
    already using locks all of them out, with no error until someone tries to log in. When new
    passwords are what you want, say so:  RESET_PASSWORDS=1 npm run db:seed
  */
  const reset = process.env.RESET_PASSWORDS === '1';
  for (const w of wanted) {
    const existing = await prisma.user.findUnique({ where: { login: w.login }, select: { id: true } });
    const profile = { fullName: w.fullName, role: w.role, position: w.position, firmId: w.firmId, isActive: true };
    if (existing && !reset) {
      await prisma.user.update({ where: { id: existing.id }, data: profile });
      continue;
    }
    // Each rahbar gets their own. One secret across nine directors is one leak away from nine
    // firms, and there would be no way to change it for just one of them.
    const password = newPassword(w.marker);
    const secret = { passwordHash: await hashPassword(password), plainPassword: password };
    if (existing) await prisma.user.update({ where: { id: existing.id }, data: { ...profile, ...secret } });
    else await prisma.user.create({ data: { login: w.login, ...profile, ...secret } });
  }

  console.log(
    '\nSeed: %d firma, %d hisob (%d rahbar), %d eski firma, %d hisob oʻchirildi, %d faolsizlantirildi%s',
    FIRMS.length, wanted.length, RAHBAR_FIRMS.length, stale.length, deleted, deactivated.length,
    deactivated.length ? ` (${deactivated.join(', ')})` : '',
  );

  // Read back, so a run that kept existing passwords still prints the ones actually in use.
  const firmName = new Map(FIRMS.map((f) => [f.id, f.shortName ?? f.name]));
  const rows = (await prisma.user.findMany({
    where: { isActive: true },
    select: { login: true, role: true, plainPassword: true, firmId: true },
  })).sort((a, b) => wanted.findIndex((w) => w.login === a.login) - wanted.findIndex((w) => w.login === b.login));

  const cells = rows.map((r) => ({
    login: r.login,
    password: r.plainPassword ?? '(nomaʼlum)',
    role: String(r.role),
    where: r.firmId ? (firmName.get(r.firmId) ?? r.firmId) : '—',
  }));
  // Widths padded here: console.log understands %s but not a width on it — '%-7s' prints literally.
  const w1 = Math.max(...cells.map((c) => c.login.length), 5);
  const w2 = Math.max(...cells.map((c) => c.password.length), 5);
  const w3 = Math.max(...cells.map((c) => c.role.length), 3);
  const line = (a: string, b: string, c: string, d: string) =>
    `${a.padEnd(w1)} | ${b.padEnd(w2)} | ${c.padEnd(w3)} | ${d}`;

  console.log('');
  console.log(line('LOGIN', 'PAROL', 'ROL', 'FIRMA'));
  console.log(`${'-'.repeat(w1)}-+-${'-'.repeat(w2)}-+-${'-'.repeat(w3)}-+-${'-'.repeat(24)}`);
  for (const c of cells) console.log(line(c.login, c.password, c.role, c.where));
  console.log('\nHar bir foydalanuvchi birinchi kirgandan keyin parolini almashtirsin.');
}

main().finally(() => prisma.$disconnect());
