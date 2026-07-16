'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Role, ROLE_LABELS, maskPhone } from '@spravka/shared/core';
import { Modal, TextField, PasswordField, Select, Ico, RowAction, type Option } from '@spravka/shared/ui';

export type UserRow = {
  id: string; fullName: string; login: string; role: string;
  position: string | null; phone: string | null; firmId: string | null;
};

export type FirmOption = { id: string; name: string; shortName: string | null; directorName: string };

const EMPTY = { fullName: '', login: '', password: '', role: Role.YURIST as string, position: '', phone: '', firmId: '' };

const ROLE_OPTIONS: Option[] = [
  { value: Role.YURIST, label: ROLE_LABELS[Role.YURIST], dot: 'bg-brand-500' },
  { value: Role.ADMIN, label: ROLE_LABELS[Role.ADMIN], dot: 'bg-slate-400' },
  { value: Role.RAHBAR, label: ROLE_LABELS[Role.RAHBAR], dot: 'bg-violet-500' },
];

/** Dual-mode: no `user` → create; with `user` → edit (password optional). */
export function UserForm({ user, firms }: { user?: UserRow; firms: FirmOption[] }) {
  const editing = !!user;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(
    user
      ? { fullName: user.fullName, login: user.login, password: '', role: user.role, position: user.position ?? '', phone: user.phone ?? '', firmId: user.firmId ?? '' }
      : EMPTY,
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const nameOk = f.fullName.trim().split(/\s+/).filter(Boolean).length >= 2;
  // On edit the password is optional — only validated when the admin types a new one.
  const passOk = editing ? (f.password === '' || f.password.length >= 6) : f.password.length >= 6;
  // A RAHBAR *is* a firm's director — they must be attached to exactly one firm.
  const isRahbar = f.role === Role.RAHBAR;
  const firmOk = !isRahbar || !!f.firmId;
  const valid = nameOk && f.login.trim().length >= 3 && passOk && firmOk;

  async function submit() {
    setBusy(true);
    setErr('');
    const res = await fetch(editing ? `/api/users/${user!.id}` : '/api/users', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(f),
    });
    if (res.ok) {
      if (editing) setF((s) => ({ ...s, password: '' }));
      else setF(EMPTY);
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
      {editing ? (
        <RowAction label="Tahrirlash" onClick={() => setOpen(true)}>
          <Ico.pen size={16} />
        </RowAction>
      ) : (
        <button onClick={() => setOpen(true)} className="btn-primary">
          <Ico.add size={18} /> Yangi foydalanuvchi
        </button>
      )}

      <Modal
        size="lg"
        open={open}
        title={editing ? 'Foydalanuvchini tahrirlash' : 'Yangi foydalanuvchi'}
        description={editing ? 'Parolni oʻzgartirmasangiz — boʻsh qoldiring.' : 'Login va parol bilan tizimga kiradi.'}
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

          {isRahbar && (
            <div>
              <label className="field-label">Firma <span className="text-rose-500">*</span></label>
              <Select
                label="Firma"
                placeholder="Firmani tanlang"
                value={f.firmId}
                onChange={set('firmId')}
                options={firms.map<Option>((fi) => ({
                  value: fi.id,
                  label: `${fi.shortName ?? fi.name} — ${fi.directorName}`,
                }))}
              />
              <p className="mt-1.5 text-xs text-muted">
                Rahbar — shu firmaning ijrochi direktori. Har firmada bitta boʻladi.
              </p>
              {!firmOk && f.role === Role.RAHBAR && (
                <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-300">Rahbar uchun firma majburiy.</p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Login" required value={f.login} onChange={set('login')} placeholder="yurist2"
              error={f.login && f.login.trim().length < 3 ? 'Kamida 3 belgi' : undefined}
            />
            <PasswordField
              label="Parol" required={!editing} value={f.password} onChange={set('password')}
              placeholder={editing ? 'Oʻzgartirmaslik uchun boʻsh qoldiring' : '••••••••'}
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
