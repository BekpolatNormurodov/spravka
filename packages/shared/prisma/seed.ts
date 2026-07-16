import { prisma } from '../src/db/index';
import { Role } from '../src/core/index';
import { hashPassword } from '../src/core/password';

async function main() {
  const firms = [
    {
      // Rekvizitlar taken verbatim from the source .docx letterhead (word/header1.xml).
      id: 'firm_bright_future',
      name: '“BRIGHT FUTURE FINANCING MIKROMOLIYA TASHKILOTI” МЧЖ',
      shortName: 'BRIGHT FUTURE FINANCING',
      directorName: 'А.А.Бойназаров',
      directorPosition: 'Ижрочи директори',
      executorName: 'Б.Тоиров',
      executorPhone: '+99855-503-01-90',
      phone: '+99855-503-01-90',
      address: 'Тошкент шахри, Олмазор тумани Гуручарик МФЙ, Сагбон кучаси 30 берк, 7/1 уй.',
      stir: '311976765',
      bankAccount: '20216000207212842001',
      mfo: '01183',
      bankName: 'АО "ANORBANK"',
      region: 'Toshkent',
    },
    { id: 'firm_2', name: 'МИКРОМОЛИЯ ТАШКИЛОТИ 2 МЧЖ', directorName: 'Ф.И.Ш.', executorName: 'Ф.И.Ш.', phone: '+998000000002' },
    { id: 'firm_3', name: 'МИКРОМОЛИЯ ТАШКИЛОТИ 3 МЧЖ', directorName: 'Ф.И.Ш.', executorName: 'Ф.И.Ш.', phone: '+998000000003' },
    { id: 'firm_4', name: 'МИКРОМОЛИЯ ТАШКИЛОТИ 4 МЧЖ', directorName: 'Ф.И.Ш.', executorName: 'Ф.И.Ш.', phone: '+998000000004' },
    { id: 'firm_5', name: 'МИКРОМОЛИЯ ТАШКИЛОТИ 5 МЧЖ', directorName: 'Ф.И.Ш.', executorName: 'Ф.И.Ш.', phone: '+998000000005' },
  ];

  for (const f of firms) {
    await prisma.firm.upsert({ where: { id: f.id }, update: f, create: f });
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

  console.log('Seed complete: %d firms, %d users', firms.length, users.length);
}

main().finally(() => prisma.$disconnect());
