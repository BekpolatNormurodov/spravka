'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { maskAmount, unmaskAmount, maskPassport, maskPinfl, isValidPinfl } from '@spravka/shared/core';
import { TextField, DateField, Select, Ico, type Option } from '@spravka/shared/ui';

type Firm = { id: string; name: string; shortName: string | null };

const today = () => new Date().toISOString().slice(0, 10);

export function CreateAriza({ firms }: { firms: Firm[] }) {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<'' | 'draft' | 'submit'>('');
  const [lookup, setLookup] = useState<'' | 'searching' | 'found' | 'new'>('');
  const [prevCount, setPrevCount] = useState(0);
  const [f, setF] = useState({
    firmId: firms[0]?.id ?? '',
    personPinfl: '',
    personFullName: '',
    personPassport: '',
    passportIssuedBy: '',
    passportIssuedAt: '',
    contractNumber: '',
    contractDate: '',
    contractType: '«Микроқарз» универсал шартномаси',
    loanAmount: '',
    asOfDate: today(),
    issueDate: today(),
  });

  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  // PINFL lookup — autofills a repeat client so the data stays consistent across arizas.
  useEffect(() => {
    if (!isValidPinfl(f.personPinfl)) {
      setLookup('');
      return;
    }
    let cancelled = false;
    setLookup('searching');
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clients?pinfl=${f.personPinfl}`);
        const d = await res.json();
        if (cancelled) return;
        if (d.found) {
          setF((s) => ({
            ...s,
            personFullName: d.client.fullName,
            personPassport: d.client.passport,
            passportIssuedBy: d.client.passportIssuedBy ?? '',
            passportIssuedAt: d.client.passportIssuedAt ? String(d.client.passportIssuedAt).slice(0, 10) : '',
          }));
          setPrevCount(d.client._count?.certificates ?? 0);
          setLookup('found');
        } else {
          setLookup('new');
        }
      } catch {
        if (!cancelled) setLookup('');
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [f.personPinfl]);

  const pinflOk = isValidPinfl(f.personPinfl);
  const nameOk = f.personFullName.trim().length > 3;
  const passOk = /^[A-Z]{2}\d{7}$/.test(f.personPassport);
  const amountOk = unmaskAmount(f.loanAmount).length > 0;
  const valid = f.firmId && pinflOk && nameOk && passOk && f.contractNumber.trim() && f.contractDate && amountOk && f.asOfDate && f.issueDate;

  const firmOptions: Option[] = firms.map((fi) => ({ value: fi.id, label: fi.shortName ?? fi.name }));

  async function save(action: 'draft' | 'submit') {
    setBusy(action);
    setErr('');
    const res = await fetch('/api/certificates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, loanAmount: unmaskAmount(f.loanAmount), action }),
    });
    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || 'Xatolik yuz berdi');
      setBusy('');
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); save('submit'); }} className="max-w-4xl space-y-6">
      {err && (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-300">
          {err}
        </div>
      )}

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold">Firma</h2>
        <label className="field-label">Mikromoliya tashkiloti <span className="text-rose-500">*</span></label>
        <Select label="Firma" value={f.firmId} onChange={set('firmId')} options={firmOptions} />
        <p className="mt-1.5 text-xs text-muted">Blanka va imzo shu firmanikidan olinadi.</p>
      </section>

      <section className="card p-6">
        <h2 className="mb-1 text-sm font-semibold">Mijoz (jismoniy shaxs)</h2>
        <p className="mb-4 text-xs text-muted">PINFL kiriting — mijoz bazada boʻlsa maʼlumotlari avtomatik toʻladi.</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            className="sm:col-span-2"
            label="PINFL (JSHSHIR)" required value={f.personPinfl} onChange={set('personPinfl')}
            mask={maskPinfl} inputMode="numeric" placeholder="12345678901234"
            error={f.personPinfl && !pinflOk ? '14 ta raqam boʻlishi kerak' : undefined}
            hint={
              lookup === 'searching' ? 'Qidirilmoqda…'
              : lookup === 'found' ? `✓ Mijoz topildi — maʼlumotlar toʻldirildi (avval ${prevCount} ta ariza)`
              : lookup === 'new' ? 'Yangi mijoz — saqlanganda bazaga qoʻshiladi'
              : '14 ta raqam'
            }
          />
          <TextField
            className="sm:col-span-2"
            label="F.I.SH. (kirillcha)" required value={f.personFullName} onChange={set('personFullName')}
            placeholder="ЖЎРАБЕКОВА ШАХЗОДАБЕГИМ ХИКМАТУЛЛОХ ҚИЗИ"
            hint="Hujjatda aynan shu koʻrinishda chiqadi"
          />
          <TextField
            label="Passport / ID" required value={f.personPassport} onChange={set('personPassport')}
            mask={maskPassport} placeholder="AE5348993"
            error={f.personPassport && !passOk ? '2 harf + 7 raqam (AE5348993)' : undefined}
          />
          <TextField label="Kim tomonidan berilgan" value={f.passportIssuedBy} onChange={set('passportIssuedBy')} placeholder="Самарқанд шаҳар ИИБ" />
          <DateField label="Berilgan sana" value={f.passportIssuedAt} onChange={set('passportIssuedAt')} />
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold">Shartnoma va qarz</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Shartnoma raqami" required value={f.contractNumber} onChange={set('contractNumber')} inputMode="numeric" placeholder="24273" />
          <DateField label="Shartnoma sanasi" required value={f.contractDate} onChange={set('contractDate')} />
          <TextField className="sm:col-span-2" label="Shartnoma turi" value={f.contractType} onChange={set('contractType')} />
          <TextField
            label="Kredit summasi" required value={f.loanAmount} onChange={set('loanAmount')}
            mask={maskAmount} inputMode="numeric" placeholder="4 000 000" suffix="soʻm"
            hint="Hujjatda boʻsh joy bilan ajratib chiqadi"
          />
          <DateField label="Holat sanasi" required value={f.asOfDate} onChange={set('asOfDate')} hint="«... ҳолатида» deb yoziladi" />
          <DateField label="Maʼlumotnoma sanasi" required value={f.issueDate} onChange={set('issueDate')} />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={!valid || !!busy}>
          <Ico.check size={18} />
          {busy === 'submit' ? 'Yuborilmoqda…' : 'Admin tasdigʻiga yuborish'}
        </button>
        <button type="button" onClick={() => save('draft')} className="btn-ghost" disabled={!!busy}>
          {busy === 'draft' ? 'Saqlanmoqda…' : 'Qoralama saqlash'}
        </button>
        {!valid && <span className="text-xs text-muted">Majburiy (*) maydonlarni toʻldiring</span>}
      </div>
    </form>
  );
}
