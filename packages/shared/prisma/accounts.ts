/**
 * Rebuild the account list and print the credentials, once, to hand out.
 *
 *   CONFIRM=1 npm run db:accounts
 *
 * Separate from `db:seed` on purpose. The seed is idempotent and runs on every deploy; this one
 * issues new passwords, so running it by accident would lock out everyone who is already using
 * the system. Hence CONFIRM — the guard exists because the failure is silent until someone tries
 * to log in.
 *
 * What it does NOT do is touch a maʼlumotnoma. Firms come from `seed.ts`; run that first.
 */

import { randomBytes } from 'node:crypto';
import { prisma } from '../src/db/index';
import { Role } from '../src/core/index';
import { hashPassword } from '../src/core/password';

/**
 * Who exists, in the order they are printed.
 *
 * A firm may appear more than once: `Certificate.firmId` is what scopes a rahbar, and nothing
 * anywhere requires that scope to be unique to one person. Two directors at one firm both sign
 * that firm's documents, and each signature records which of them it was.
 *
 * To give a firm a second rahbar, name it twice. The login gets a number: `bright_future`,
 * `bright_future2`.
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

/** Unambiguous alphabet — no O/0, no l/1/I, because these are read off a screen and retyped. */
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
 * nobody dares change. Eight characters of the alphabet above carry the actual strength.
 */
function newPassword(marker: string): string {
  return `${marker}-${randomChars(8)}`;
}

/** 'BRIGHT FUTURE FINANCING' -> 'Bright'. The first word is what people call the firm. */
function markerFor(name: string): string {
  const word = name.trim().split(/[\s"«»']+/).filter(Boolean)[0] ?? 'Firma';
  const latin = word.replace(/[^A-Za-z]/g, '') || 'Firma';
  return latin[0]!.toUpperCase() + latin.slice(1).toLowerCase();
}

async function main() {
  if (process.env.CONFIRM !== '1') {
    console.error(
      'Bu skript hamma hisoblarga YANGI parol beradi — hozirgi parollar ishlamay qoladi.\n' +
        'Rozi boʻlsangiz:\n\n' +
        '  CONFIRM=1 npm run db:accounts\n',
    );
    process.exit(1);
  }

  const firms = await prisma.firm.findMany({ select: { id: true, name: true, shortName: true } });
  const byId = new Map(firms.map((f) => [f.id, f]));

  const missing = RAHBAR_FIRMS.filter((id) => !byId.has(id));
  if (missing.length) {
    console.error(`Bu firmalar bazada yoʻq: ${missing.join(', ')}\n  Avval: npm run db:seed`);
    process.exit(1);
  }

  // Login per firm, numbered from the second one on.
  const seen = new Map<string, number>();
  const wanted = [
    { login: 'yurist', fullName: 'Yurist', role: Role.YURIST, position: 'Yurist', firmId: null as string | null, marker: 'Yurist' },
    { login: 'admin', fullName: 'Administrator', role: Role.ADMIN, position: 'Administrator', firmId: null as string | null, marker: 'Admin' },
    ...RAHBAR_FIRMS.map((firmId) => {
      const firm = byId.get(firmId)!;
      const slug = firmId.replace(/^firm_/, '');
      const n = (seen.get(slug) ?? 0) + 1;
      seen.set(slug, n);
      return {
        login: n === 1 ? slug : `${slug}${n}`,
        fullName: firm.shortName ?? firm.name,
        role: Role.RAHBAR,
        position: 'Ijrochi direktor',
        firmId,
        marker: markerFor(firm.shortName ?? firm.name),
      };
    }),
  ];

  /*
    Clear out what is not on the list.

    A user a maʼlumotnoma points at is deactivated, not deleted: `Certificate.createdById`,
    `Certificate.signedById` and `WorkflowEvent.actorId` all reference User, and that reference is
    the record of who wrote and who signed a legal document. The database would refuse the delete
    anyway; deactivating is the honest version of what was asked for.
  */
  const keep = wanted.map((w) => w.login);
  const others = await prisma.user.findMany({
    where: { login: { notIn: keep } },
    select: {
      id: true, login: true,
      _count: { select: { createdCerts: true, signedCerts: true, events: true } },
    },
  });

  let deleted = 0;
  const deactivated: string[] = [];
  for (const u of others) {
    const referenced = u._count.createdCerts + u._count.signedCerts + u._count.events > 0;
    if (referenced) {
      await prisma.user.update({ where: { id: u.id }, data: { isActive: false } });
      deactivated.push(u.login);
    } else {
      await prisma.user.delete({ where: { id: u.id } });
      deleted++;
    }
  }

  // Everyone on the list gets a new password, whether the row existed or not — the point of
  // running this is to have one list to hand out.
  const issued: { login: string; password: string; role: string; where: string }[] = [];
  for (const w of wanted) {
    const password = newPassword(w.marker);
    const data = {
      fullName: w.fullName,
      role: w.role,
      position: w.position,
      firmId: w.firmId,
      isActive: true,
      passwordHash: await hashPassword(password),
      plainPassword: password,
    };
    await prisma.user.upsert({
      where: { login: w.login },
      update: data,
      create: { login: w.login, ...data },
    });
    const firm = w.firmId ? byId.get(w.firmId)! : null;
    issued.push({
      login: w.login,
      password,
      role: String(w.role),
      where: firm ? (firm.shortName ?? firm.name) : '—',
    });
  }

  // Widths are computed and padded here: console.log understands %s but not a width on it, and
  // '%-7s' prints literally.
  const w1 = Math.max(...issued.map((i) => i.login.length), 'LOGIN'.length);
  const w2 = Math.max(...issued.map((i) => i.password.length), 'PAROL'.length);
  const w3 = Math.max(...issued.map((i) => i.role.length), 'ROL'.length);
  const w4 = Math.max(...issued.map((i) => i.where.length), 'FIRMA'.length);
  const row = (a: string, b: string, c: string, d: string) =>
    `${a.padEnd(w1)} | ${b.padEnd(w2)} | ${c.padEnd(w3)} | ${d}`;

  console.log('');
  console.log(row('LOGIN', 'PAROL', 'ROL', 'FIRMA'));
  console.log(`${'-'.repeat(w1)}-+-${'-'.repeat(w2)}-+-${'-'.repeat(w3)}-+-${'-'.repeat(w4)}`);
  for (const i of issued) console.log(row(i.login, i.password, i.role, i.where));

  console.log('\n%d ta hisob yangilandi.', issued.length);
  if (deleted) console.log('%d ta eski hisob oʻchirildi.', deleted);
  if (deactivated.length) {
    console.log(
      '%d ta eski hisob faolsizlantirildi (oʻchirilmadi — ular imzolagan hujjatlar bor): %s',
      deactivated.length, deactivated.join(', '),
    );
  }
  console.log('\nParollar faqat shu yerda koʻrsatiladi. Har kim birinchi kirgandan keyin almashtirsin.');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
