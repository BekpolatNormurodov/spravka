import { prisma } from '@/lib/prisma';
import { ROLE_LABELS, Role, dmy } from '@spravka/shared/core';
import { PageHeader, EmptyState } from '@spravka/shared/ui';
import { UserForm } from './UserForm';

export const dynamic = 'force-dynamic';

const ROLE_TONE: Record<string, string> = {
  [Role.YURIST]: 'border-brand-500/30 bg-brand-500/10 text-brand-700 dark:text-brand-400',
  [Role.ADMIN]: 'border-slate-400/30 bg-slate-400/10 text-fg',
  [Role.RAHBAR]: 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300',
};

export default async function Foydalanuvchilar() {
  const [users, firms] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true, fullName: true, login: true, role: true, position: true, phone: true,
        plainPassword: true, isActive: true, lastLoginAt: true, firmId: true,
        _count: { select: { createdCerts: true, signedCerts: true } },
      },
    }),
    prisma.firm.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, shortName: true, directorName: true },
    }),
  ]);
  const firmName = (id: string | null) => {
    const f = firms.find((x) => x.id === id);
    return f ? (f.shortName ?? f.name) : null;
  };

  const byRole = (r: Role) => users.filter((u) => u.role === r).length;

  return (
    <div>
      <PageHeader
        title="Foydalanuvchilar"
        subtitle={`${byRole(Role.YURIST)} yurist · ${byRole(Role.ADMIN)} admin · ${byRole(Role.RAHBAR)} rahbar`}
        action={<UserForm firms={firms} />}
      />

      {users.length === 0 ? (
        <EmptyState title="Foydalanuvchi yoʻq" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-sm">
              <thead className="bg-surface-2 text-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">F.I.SH.</th>
                  <th className="px-4 py-3 text-left font-medium">Login</th>
                  <th className="px-4 py-3 text-left font-medium">Parol</th>
                  <th className="px-4 py-3 text-left font-medium">Rol</th>
                  <th className="px-4 py-3 text-left font-medium">Firma</th>
                  <th className="px-4 py-3 text-left font-medium">Telefon</th>
                  <th className="px-4 py-3 text-right font-medium">Arizalar</th>
                  <th className="px-4 py-3 text-left font-medium">Oxirgi kirish</th>
                  <th className="px-4 py-3 text-left font-medium">Holat</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-line transition-colors hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold">
                          {u.fullName.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                        </span>
                        <span>
                          <span className="font-medium">{u.fullName}</span>
                          {u.position && <span className="block text-xs text-muted">{u.position}</span>}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-fg">{u.login}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">{u.plainPassword ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${ROLE_TONE[u.role]}`}>{ROLE_LABELS[u.role as Role]}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{firmName(u.firmId) ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted">{u.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {u.role === Role.RAHBAR ? u._count.signedCerts : u._count.createdCerts}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted">
                      {u.lastLoginAt ? dmy(u.lastLoginAt) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${u.isActive ? 'border-accent-500/30 bg-accent-500/10 text-accent-700 dark:text-accent-400' : 'border-slate-400/25 bg-slate-400/10 text-muted'}`}>
                        {u.isActive ? 'Faol' : 'Nofaol'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right"><UserForm user={u} firms={firms} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
