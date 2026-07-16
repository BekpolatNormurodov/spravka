import { prisma } from '../src/db/index';
import { Role } from '../src/core/index';
import { hashPassword } from '../src/core/password';

async function main() {
  const firms = [
    {
      id: 'firm_bright_future',
      name: '“BRIGHT FUTURE FINANCING MIKROMOLIYA TASHKILOTI” МЧЖ',
      shortName: 'BRIGHT FUTURE FINANCING',
      directorName: 'А.А.Бойназаров',
      executorName: 'Б.Тоиров',
      executorPhone: '+99855-503-01-90',
      phone: '+99855-503-01-90',
      region: 'Samarqand',
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
    { login: 'rahbar', fullName: 'Rahbar Foydalanuvchi', role: Role.RAHBAR, position: 'Ijrochi direktor' },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { login: u.login },
      update: { fullName: u.fullName, role: u.role, position: u.position },
      create: { ...u, passwordHash: pass, plainPassword: 'parol123' },
    });
  }

  console.log('Seed complete: %d firms, %d users', firms.length, users.length);
}

main().finally(() => prisma.$disconnect());
