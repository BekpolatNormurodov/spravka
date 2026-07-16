'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const EMPTY = {
  name: '', shortName: '', directorName: '', executorName: '',
  executorPhone: '', phone: '', stir: '', region: '', address: '',
};

export function FirmForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const res = await fetch('/api/firms', {
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
    return <button onClick={() => setOpen(true)} className="btn-primary">+ Yangi firma</button>;
  }

  return (
    <form onSubmit={submit} className="card p-6 space-y-4">
      {err && <div className="text-sm text-rose-600 dark:text-rose-300">{err}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="field-label">Toʻliq nomi (kirillcha) *</label>
          <input className="field-input" value={f.name} onChange={set('name')} placeholder="“... МИКРОМОЛИЯ ТАШКИЛОТИ” МЧЖ" required />
        </div>
        <div><label className="field-label">Qisqa nomi</label><input className="field-input" value={f.shortName} onChange={set('shortName')} /></div>
        <div><label className="field-label">STIR</label><input className="field-input" value={f.stir} onChange={set('stir')} /></div>
        <div><label className="field-label">Direktor (F.I.SH.) *</label><input className="field-input" value={f.directorName} onChange={set('directorName')} required /></div>
        <div><label className="field-label">Ijrochi *</label><input className="field-input" value={f.executorName} onChange={set('executorName')} required /></div>
        <div><label className="field-label">Telefon *</label><input className="field-input" value={f.phone} onChange={set('phone')} required /></div>
        <div><label className="field-label">Ijrochi telefoni</label><input className="field-input" value={f.executorPhone} onChange={set('executorPhone')} /></div>
        <div><label className="field-label">Region</label><input className="field-input" value={f.region} onChange={set('region')} /></div>
        <div className="sm:col-span-2"><label className="field-label">Manzil</label><input className="field-input" value={f.address} onChange={set('address')} /></div>
      </div>
      <div className="flex gap-3">
        <button className="btn-primary" disabled={busy}>{busy ? 'Saqlanmoqda…' : 'Saqlash'}</button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Bekor</button>
      </div>
    </form>
  );
}
