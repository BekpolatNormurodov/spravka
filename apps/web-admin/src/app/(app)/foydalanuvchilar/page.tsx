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
      <p className="text-sm text-slate-400 mb-6">Tizim foydalanuvchilari va rollari</p>

      <UserForm />

      <div className="card overflow-hidden mt-6">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-slate-400">
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
              <tr key={u.id} className="border-t border-white/5">
                <td className="px-4 py-3">{u.fullName}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-300">{u.login}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{u.plainPassword ?? '—'}</td>
                <td className="px-4 py-3 text-slate-300">{ROLE_LABELS[u.role as Role]}</td>
                <td className="px-4 py-3">
                  <span className={u.isActive ? 'text-emerald-400' : 'text-slate-500'}>{u.isActive ? 'Faol' : 'Nofaol'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
