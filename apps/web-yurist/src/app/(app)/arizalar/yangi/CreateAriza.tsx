'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Firm = { id: string; name: string; shortName: string | null };

const today = () => new Date().toISOString().slice(0, 10);

export function CreateAriza({ firms }: { firms: Firm[] }) {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<'' | 'draft' | 'submit'>('');
  const [f, setF] = useState({
    firmId: firms[0]?.id ?? '',
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

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  async function save(action: 'draft' | 'submit') {
    setBusy(action);
    setErr('');
    const res = await fetch('/api/certificates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, action }),
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
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save('submit');
      }}
      className="space-y-6"
    >
      {err && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{err}</div>
      )}

      <section className="card p-6">
        <h2 className="text-sm font-semibold text-slate-200 mb-4">Firma</h2>
        <label className="field-label">Mikromoliya tashkiloti *</label>
        <select className="field-input" value={f.firmId} onChange={set('firmId')} required>
          {firms.map((fi) => (
            <option key={fi.id} value={fi.id}>{fi.shortName ?? fi.name}</option>
          ))}
        </select>
      </section>

      <section className="card p-6">
        <h2 className="text-sm font-semibold text-slate-200 mb-4">Jismoniy shaxs</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="field-label">F.I.SH. (kirillcha) *</label>
            <input className="field-input" value={f.personFullName} onChange={set('personFullName')} placeholder="ЖЎРАБЕКОВА ШАХЗОДАБЕГИМ ..." required />
          </div>
          <div>
            <label className="field-label">Passport / ID *</label>
            <input className="field-input" value={f.personPassport} onChange={set('personPassport')} placeholder="AE5348993" required />
          </div>
          <div>
            <label className="field-label">Kim tomonidan berilgan</label>
            <input className="field-input" value={f.passportIssuedBy} onChange={set('passportIssuedBy')} placeholder="Самарқанд шаҳар ИИБ" />
          </div>
          <div>
            <label className="field-label">Berilgan sana</label>
            <input className="field-input" type="date" value={f.passportIssuedAt} onChange={set('passportIssuedAt')} />
          </div>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-sm font-semibold text-slate-200 mb-4">Shartnoma va qarz</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label">Shartnoma raqami *</label>
            <input className="field-input" value={f.contractNumber} onChange={set('contractNumber')} placeholder="24273" required />
          </div>
          <div>
            <label className="field-label">Shartnoma sanasi *</label>
            <input className="field-input" type="date" value={f.contractDate} onChange={set('contractDate')} required />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label">Shartnoma turi</label>
            <input className="field-input" value={f.contractType} onChange={set('contractType')} />
          </div>
          <div>
            <label className="field-label">Kredit summasi (soʻm) *</label>
            <input className="field-input" value={f.loanAmount} onChange={set('loanAmount')} placeholder="4000000" inputMode="numeric" required />
          </div>
          <div>
            <label className="field-label">Holat sanasi *</label>
            <input className="field-input" type="date" value={f.asOfDate} onChange={set('asOfDate')} required />
          </div>
          <div>
            <label className="field-label">Maʼlumotnoma sanasi *</label>
            <input className="field-input" type="date" value={f.issueDate} onChange={set('issueDate')} required />
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={!!busy}>
          {busy === 'submit' ? 'Yuborilmoqda…' : 'Admin tasdigʻiga yuborish'}
        </button>
        <button type="button" onClick={() => save('draft')} className="btn-ghost" disabled={!!busy}>
          {busy === 'draft' ? 'Saqlanmoqda…' : 'Qoralama saqlash'}
        </button>
      </div>
    </form>
  );
}
