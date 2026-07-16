'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const EMPTY = { fullName: '', login: '', password: '', role: 'YURIST', position: '', phone: '' };

export function UserForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(f),
    });
    if (res.ok) {
      setF(EMPTY);
      setOpen(false);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || 'Xatolik');
    }
    setBusy(false);
  }

  if (!open) {
    return <button onClick={() => setOpen(true)} className="btn-primary">+ Yangi foydalanuvchi</button>;
  }

  return (
    <form onSubmit={submit} className="card p-6 space-y-4">
      {err && <div className="text-sm text-rose-600 dark:text-rose-300">{err}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="field-label">F.I.SH. *</label><input className="field-input" value={f.fullName} onChange={set('fullName')} required /></div>
        <div><label className="field-label">Login *</label><input className="field-input" value={f.login} onChange={set('login')} required /></div>
        <div><label className="field-label">Parol *</label><input className="field-input" value={f.password} onChange={set('password')} required /></div>
        <div>
          <label className="field-label">Rol *</label>
          <select className="field-input" value={f.role} onChange={set('role')}>
            <option value="YURIST">Yurist</option>
            <option value="ADMIN">Admin</option>
            <option value="RAHBAR">Rahbar</option>
          </select>
        </div>
        <div><label className="field-label">Lavozim</label><input className="field-input" value={f.position} onChange={set('position')} /></div>
        <div><label className="field-label">Telefon</label><input className="field-input" value={f.phone} onChange={set('phone')} /></div>
      </div>
      <div className="flex gap-3">
        <button className="btn-primary" disabled={busy}>{busy ? 'Saqlanmoqda…' : 'Saqlash'}</button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Bekor</button>
      </div>
    </form>
  );
}
