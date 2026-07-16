'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { maskStir, maskPhone, maskAccount, maskMfo } from '@spravka/shared/core';
import { Modal, TextField, Ico, RowAction } from '@spravka/shared/ui';

export type FirmRow = {
  id: string; name: string; letterheadName: string | null; shortName: string | null; stir: string | null;
  directorName: string; directorFullName: string | null; directorPosition: string;
  accountantName: string | null; executorName: string | null;
  executorPhone: string | null; phone: string | null; bankName: string | null;
  bankAccount: string | null; mfo: string | null; region: string | null; address: string | null;
};

const EMPTY = {
  name: '', letterheadName: '', shortName: '', stir: '',
  directorName: '', directorFullName: '', directorPosition: 'Ижрочи директори',
  accountantName: '', executorName: '', executorPhone: '', phone: '',
  bankName: '', bankAccount: '', mfo: '', region: '', address: '',
};

const fromRow = (r: FirmRow) => ({
  name: r.name, letterheadName: r.letterheadName ?? '', shortName: r.shortName ?? '', stir: r.stir ?? '',
  directorName: r.directorName, directorFullName: r.directorFullName ?? '',
  directorPosition: r.directorPosition, accountantName: r.accountantName ?? '',
  executorName: r.executorName ?? '', executorPhone: r.executorPhone ?? '', phone: r.phone ?? '',
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
  const valid = f.name.trim() && directorOk;

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
        size="xl"
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

        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
          <TextField
            label="Nomi — hujjat matnida" required value={f.name} onChange={set('name')}
            placeholder="“... MIKROMOLIYA TASHKILOTI” МЧЖ"
            hint="Maʼlumotnoma matnidagi «... билан ... ўртасида» jumlasida shu nom chiqadi."
          />
          <TextField
            label="Nomi — blankada va imzoda" value={f.letterheadName} onChange={set('letterheadName')}
            placeholder="«... MIKROMOLIYA TASHKILOTI» MCHJ"
            hint="Firmalar blankasida odatda «MCHJ», matnda esa «МЧЖ» yoziladi. Boʻsh boʻlsa — yuqoridagi nom ishlatiladi."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Qisqa nomi" value={f.shortName} onChange={set('shortName')} placeholder="BRIGHT FUTURE FINANCING" />
            <TextField label="STIR" value={f.stir} onChange={set('stir')} mask={maskStir} inputMode="numeric" placeholder="311976765" hint="9 raqam" />
          </div>

          <div className="rounded-xl border border-line p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Ijrochi direktor (majburiy, bitta)</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Imzo blokidagi ism" required value={f.directorName} onChange={set('directorName')}
                placeholder="А.А.Бойназаров"
                error={f.directorName && !directorOk ? 'Masalan: А.А.Бойназаров yoki Ism Familiya' : undefined}
                hint={!f.directorName ? 'Hujjatda aynan shu koʻrinishda chiqadi' : undefined}
              />
              <TextField label="Lavozimi" value={f.directorPosition} onChange={set('directorPosition')} placeholder="Ижрочи директори" />
              <TextField
                label="Toʻliq F.I.Sh." value={f.directorFullName} onChange={set('directorFullName')}
                placeholder="BOYNAZAROV AKRAM ANVAROVICH" className="sm:col-span-2"
                hint="Reyestrdagi toʻliq ism — hujjatda chiqmaydi, faqat maʼlumot uchun."
              />
            </div>
          </div>

          <TextField
            label="Bosh buxgalter" value={f.accountantName} onChange={set('accountantName')}
            placeholder="SHAKIROV ULUGʻBEK OYBEKOVICH" hint="Hujjatda chiqmaydi."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Ijrochi" value={f.executorName} onChange={set('executorName')} placeholder="Б.Тоиров" hint="Hujjat pastidagi «Ижрочи» qatori. Boʻsh boʻlsa — qator chiqmaydi." />
            <TextField label="Ijrochi telefoni" value={f.executorPhone} onChange={set('executorPhone')} mask={maskPhone} inputMode="tel" placeholder="+998 55 503 01 90" />
            <TextField label="Telefon" value={f.phone} onChange={set('phone')} mask={maskPhone} inputMode="tel" placeholder="+998 55 503 01 90" />
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
