'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { maskStir, maskPhone, maskAccount, maskMfo } from '@spravka/shared/core';
import { Modal, TextField, Ico, RowAction } from '@spravka/shared/ui';

export type FirmRow = {
  id: string; name: string; shortName: string | null; stir: string | null;
  directorName: string; directorPosition: string; executorName: string;
  executorPhone: string | null; phone: string; bankName: string | null;
  bankAccount: string | null; mfo: string | null; region: string | null; address: string | null;
};

const EMPTY = {
  name: '', shortName: '', stir: '',
  directorName: '', directorPosition: 'Ижрочи директори',
  executorName: '', executorPhone: '', phone: '',
  bankName: '', bankAccount: '', mfo: '', region: '', address: '',
};

const fromRow = (r: FirmRow) => ({
  name: r.name, shortName: r.shortName ?? '', stir: r.stir ?? '',
  directorName: r.directorName, directorPosition: r.directorPosition,
  executorName: r.executorName, executorPhone: r.executorPhone ?? '', phone: r.phone,
  bankName: r.bankName ?? '', bankAccount: r.bankAccount ? maskAccount(r.bankAccount) : '',
  mfo: r.mfo ?? '', region: r.region ?? '', address: r.address ?? '',
});

/** Dual-mode: no `firm` → create; with `firm` → edit that firm. */
export function FirmForm({ firm }: { firm?: FirmRow }) {
  const editing = !!firm;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(firm ? fromRow(firm) : EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  // Exactly one director per firm. Accepts the official 'А.А.Бойназаров' form (initials +
  // surname, no spaces) as well as 'Ism Familiya' — dots count as separators.
  const directorOk = f.directorName.trim().split(/[.\s]+/).filter(Boolean).length >= 2;
  const valid = f.name.trim() && directorOk && f.executorName.trim() && f.phone.trim();

  async function submit() {
    setBusy(true);
    setErr('');
    const res = await fetch(editing ? `/api/firms/${firm!.id}` : '/api/firms', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, bankAccount: f.bankAccount.replace(/\s/g, '') }),
    });
    if (res.ok) {
      if (!editing) setF(EMPTY);
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
          <Ico.add size={18} /> Yangi firma
        </button>
      )}

      <Modal
        open={open}
        title={editing ? `Firmani tahrirlash` : 'Yangi firma'}
        description={editing ? 'Oʻzgarish faqat YANGI hujjatlarga taʼsir qiladi — imzolangan hujjatlar oʻzgarmaydi.' : 'Rekvizitlar maʼlumotnoma blankasida chiqadi.'}
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

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <TextField
            label="Toʻliq nomi (kirillcha)" required value={f.name} onChange={set('name')}
            placeholder="“... МИКРОМОЛИЯ ТАШКИЛОТИ” МЧЖ"
            hint="Hujjat matnida va blankada shu nom chiqadi."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Qisqa nomi" value={f.shortName} onChange={set('shortName')} placeholder="BRIGHT FUTURE FINANCING" />
            <TextField label="STIR" value={f.stir} onChange={set('stir')} mask={maskStir} inputMode="numeric" placeholder="311976765" hint="9 raqam" />
          </div>

          <div className="rounded-xl border border-line p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Ijrochi direktor (majburiy, bitta)</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Ism familiya" required value={f.directorName} onChange={set('directorName')}
                placeholder="А.А.Бойназаров"
                error={f.directorName && !directorOk ? 'Masalan: А.А.Бойназаров yoki Ism Familiya' : undefined}
                hint={!f.directorName ? 'Imzo blokida shu ism chiqadi' : undefined}
              />
              <TextField label="Lavozimi" value={f.directorPosition} onChange={set('directorPosition')} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Ijrochi" required value={f.executorName} onChange={set('executorName')} placeholder="Б.Тоиров" />
            <TextField label="Ijrochi telefoni" value={f.executorPhone} onChange={set('executorPhone')} mask={maskPhone} inputMode="tel" placeholder="+998 55 503 01 90" />
            <TextField label="Telefon" required value={f.phone} onChange={set('phone')} mask={maskPhone} inputMode="tel" placeholder="+998 55 503 01 90" />
            <TextField label="Region" value={f.region} onChange={set('region')} placeholder="Toshkent" />
          </div>

          <TextField label="Yuridik manzil" value={f.address} onChange={set('address')} placeholder="Тошкент шахри, ..." />

          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Bank" value={f.bankName} onChange={set('bankName')} placeholder='АО "ANORBANK"' className="sm:col-span-3" />
            <TextField label="Hisob raqami (х/р)" value={f.bankAccount} onChange={set('bankAccount')} mask={maskAccount} inputMode="numeric" placeholder="2021 6000 2072 1284 2001" className="sm:col-span-2" hint="20 raqam" />
            <TextField label="MFO" value={f.mfo} onChange={set('mfo')} mask={maskMfo} inputMode="numeric" placeholder="01183" />
          </div>
        </div>
      </Modal>
    </>
  );
}
