'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Role, ROLE_LABELS, maskPhone } from '@spravka/shared/core';
import { Modal, TextField, PasswordField, Select, Ico, type Option } from '@spravka/shared/ui';

const EMPTY = { fullName: '', login: '', password: '', role: Role.YURIST as string, position: '', phone: '' };

const ROLE_OPTIONS: Option[] = [
  { value: Role.YURIST, label: ROLE_LABELS[Role.YURIST], dot: 'bg-brand-500' },
  { value: Role.ADMIN, label: ROLE_LABELS[Role.ADMIN], dot: 'bg-slate-400' },
  { value: Role.RAHBAR, label: ROLE_LABELS[Role.RAHBAR], dot: 'bg-violet-500' },
];

export function UserForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const nameOk = f.fullName.trim().split(/\s+/).filter(Boolean).length >= 2;
  const valid = nameOk && f.login.trim().length >= 3 && f.password.length >= 6;

  async function submit() {
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

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Ico.add size={18} /> Yangi foydalanuvchi
      </button>

      <Modal
        open={open}
        title="Yangi foydalanuvchi"
        description="Login va parol bilan tizimga kiradi."
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)} type="button">Bekor</button>
            <button className="btn-primary" disabled={!valid || busy} onClick={submit} type="button">
              {busy ? 'Saqlanmoqda…' : 'Saqlash'}
            </button>
          </>
        }
      >
        {err && <p className="mb-3 text-sm text-rose-600 dark:text-rose-300">{err}</p>}

        <div className="space-y-4">
          <TextField
            label="Ism familiya" required value={f.fullName} onChange={set('fullName')}
            placeholder="Bekzod Toirov"
            error={f.fullName && !nameOk ? 'Ism va familiyani toʻliq yozing' : undefined}
          />

          <div>
            <label className="field-label">Rol <span className="text-rose-500">*</span></label>
            <Select label="Rol" value={f.role} onChange={set('role')} options={ROLE_OPTIONS} />
            <p className="mt-1.5 text-xs text-muted">Har rol faqat oʻz paneliga kira oladi.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Login" required value={f.login} onChange={set('login')} placeholder="yurist2"
              error={f.login && f.login.trim().length < 3 ? 'Kamida 3 belgi' : undefined}
            />
            <PasswordField
              label="Parol" required value={f.password} onChange={set('password')} placeholder="••••••••"
              error={f.password && f.password.length < 6 ? 'Kamida 6 belgi' : undefined}
            />
            <TextField label="Lavozim" value={f.position} onChange={set('position')} placeholder="Yurist" />
            <TextField label="Telefon" value={f.phone} onChange={set('phone')} mask={maskPhone} inputMode="tel" placeholder="+998 90 123 45 67" />
          </div>
        </div>
      </Modal>
    </>
  );
}
