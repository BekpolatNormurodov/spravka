import { prisma } from '@/lib/prisma';
import { ROLE_LABELS, Role } from '@spravka/shared/core';
import { UserForm } from './UserForm';

export const dynamic = 'force-dynamic';

export default async function Foydalanuvchilar() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, fullName: true, login: true, role: true, position: true, plainPassword: true, isActive: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Foydalanuvchilar</h1>
      <p className="text-sm text-muted mb-6">Tizim foydalanuvchilari va rollari</p>

      <UserForm />

      <div className="card overflow-hidden mt-6">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-muted">
            <tr>
              <th className="text-left font-medium px-4 py-3">F.I.SH.</th>
              <th className="text-left font-medium px-4 py-3">Login</th>
              <th className="text-left font-medium px-4 py-3">Parol</th>
              <th className="text-left font-medium px-4 py-3">Rol</th>
              <th className="text-left font-medium px-4 py-3">Holat</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-line">
                <td className="px-4 py-3">{u.fullName}</td>
                <td className="px-4 py-3 font-mono text-xs text-fg">{u.login}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted">{u.plainPassword ?? '—'}</td>
                <td className="px-4 py-3 text-fg">{ROLE_LABELS[u.role as Role]}</td>
                <td className="px-4 py-3">
                  <span className={u.isActive ? 'text-accent-600 dark:text-accent-400' : 'text-muted'}>{u.isActive ? 'Faol' : 'Nofaol'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
