'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { maskAmount, unmaskAmount, maskPassport, maskPinfl, isValidPinfl } from '@spravka/shared/core';
import {
  TextField, DateField, Select, Ico, ContractRows, contractRowsValid, emptyContractRow,
  type Option, type ContractRow,
} from '@spravka/shared/ui';

type Firm = {
  id: string;
  name: string;
  shortName: string | null;
  letterheadName: string | null;
  stir: string | null;
  bankAccount: string | null;
  mfo: string | null;
  bankName: string | null;
  directorName: string | null;
  directorPosition: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);

/** One rekvizit line in the side panel. */
function Fact({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className={`mt-0.5 break-words text-sm ${mono ? 'font-mono tabular-nums' : ''} ${value ? '' : 'text-muted'}`}>
        {value || '—'}
      </dd>
    </div>
  );
}

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
    contractType: '«Микроқарз» универсал шартномаси',
    loanAmount: '',
    asOfDate: today(),
    issueDate: today(),
  });

  const [contracts, setContracts] = useState<ContractRow[]>([emptyContractRow()]);

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
  const valid = f.firmId && pinflOk && nameOk && passOk && contractRowsValid(contracts) && amountOk && f.asOfDate && f.issueDate;

  const firmOptions: Option[] = firms.map((fi) => ({ value: fi.id, label: fi.shortName ?? fi.name }));

  async function save(action: 'draft' | 'submit') {
    setBusy(action);
    setErr('');
    const res = await fetch('/api/certificates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, contracts, loanAmount: unmaskAmount(f.loanAmount), action }),
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

  const firm = firms.find((x) => x.id === f.firmId);

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); save('submit'); }}
      className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start"
    >
      <div className="min-w-0 space-y-6">
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
        <h2 className="mb-1 text-sm font-semibold">Shartnoma va qarz</h2>
        <p className="mb-4 text-xs text-muted">
          Bitta maʼlumotnoma bir nechta shartnomani qamrab olishi mumkin — hujjatda hammasi ketma-ket yoziladi.
        </p>
        <ContractRows rows={contracts} onChange={setContracts} disabled={!!busy} />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
      </div>

      {/* Sticky so the rekvizitlar and the actions stay in view while the form scrolls. */}
      <aside className="space-y-4 xl:sticky xl:top-20">
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold">Blanka</h2>
          {firm ? (
            <dl className="space-y-3.5">
              <Fact label="Tashkilot" value={firm.letterheadName || firm.name} />
              <Fact label="СТИР" value={firm.stir} mono />
              <Fact label="Ҳ/р" value={firm.bankAccount} mono />
              <Fact label="МФО" value={firm.mfo} mono />
              <Fact label="Банк" value={firm.bankName} />
              <Fact label={firm.directorPosition || 'Директор'} value={firm.directorName} />
            </dl>
          ) : (
            <p className="text-xs text-muted">Firma tanlanmagan.</p>
          )}
          <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
            Maʼlumotnoma aynan shu rekvizitlar bilan chiqadi.
          </p>
        </div>

        <div className="card space-y-3 p-5">
          <button type="submit" className="btn-primary w-full justify-center" disabled={!valid || !!busy}>
            <Ico.check size={18} />
            {busy === 'submit' ? 'Yuborilmoqda…' : 'Admin tasdigʻiga yuborish'}
          </button>
          <button
            type="button"
            onClick={() => save('draft')}
            className="btn-ghost w-full justify-center"
            disabled={!!busy}
          >
            {busy === 'draft' ? 'Saqlanmoqda…' : 'Qoralama saqlash'}
          </button>
          {!valid && (
            <p className="text-center text-xs text-muted">Majburiy (*) maydonlarni toʻldiring</p>
          )}
        </div>
      </aside>
    </form>
  );
}
