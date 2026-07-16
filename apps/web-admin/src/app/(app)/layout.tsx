import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { NavLink } from '@/components/NavLink';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 shrink-0 border-r border-white/10 bg-slate-900/40 p-4 flex flex-col">
        <div className="flex items-center gap-2.5 px-2 py-3 mb-4">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 font-bold">A</div>
          <div>
            <div className="text-sm font-semibold leading-tight">Admin paneli</div>
            <div className="text-xs text-slate-400">Maʼlumotnoma</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          <NavLink href="/">Monitoring</NavLink>
          <NavLink href="/arizalar">Arizalar</NavLink>
          <NavLink href="/firmalar">Firmalar</NavLink>
          <NavLink href="/foydalanuvchilar">Foydalanuvchilar</NavLink>
        </nav>

        <div className="border-t border-white/10 pt-3">
          <div className="px-2 mb-2 text-sm font-medium text-slate-200">{session.fullName}</div>
          <form action="/api/auth/logout" method="post">
            <button className="btn-ghost w-full">Chiqish</button>
          </form>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <main className="p-6 md:p-8 max-w-6xl mx-auto">{children}</main>
      </div>
    </div>
  );
}
