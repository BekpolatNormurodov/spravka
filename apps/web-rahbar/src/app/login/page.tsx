'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
    });
    if (res.ok) {
      router.replace('/');
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || 'Xatolik yuz berdi');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center p-4 bg-gradient-to-b from-slate-950 to-slate-900">
      <form onSubmit={submit} className="card w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-600 text-lg font-bold">R</div>
          <h1 className="text-xl font-bold">Rahbar paneli</h1>
          <p className="mt-1 text-sm text-slate-400">Maʼlumotnoma tizimiga kirish</p>
        </div>

        {err && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
            {err}
          </div>
        )}

        <label className="field-label">Login</label>
        <input className="field-input mb-4" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="rahbar" autoFocus />

        <label className="field-label">Parol</label>
        <input className="field-input mb-6" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />

        <button className="btn-primary w-full" disabled={loading}>
          {loading ? 'Kirilmoqda…' : 'Kirish'}
        </button>
      </form>
    </main>
  );
}
