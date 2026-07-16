'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { maskAmount, unmaskAmount, maskPassport } from '@spravka/shared/core';
import { Modal, TextField, DateField, Ico } from '@spravka/shared/ui';

export type CertEdit = {
  id: string;
  personFullName: string;
  personPassport: string;
  passportIssuedBy: string | null;
  passportIssuedAt: string | null;
  contractNumber: string;
  contractDate: string;
  contractType: string;
  loanAmount: string;
  asOfDate: string;
  issueDate: string;
};

/**
 * Admin content edit — only rendered while the ariza is still editable
 * (core's canEdit: DRAFT / ADMIN_REVIEW). The API re-checks server-side.
 */
export function EditAriza({ cert }: { cert: CertEdit }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [f, setF] = useState({
    personFullName: cert.personFullName,
    personPassport: cert.personPassport,
    passportIssuedBy: cert.passportIssuedBy ?? '',
    passportIssuedAt: cert.passportIssuedAt ?? '',
    contractNumber: cert.contractNumber,
    contractDate: cert.contractDate,
    contractType: cert.contractType,
    loanAmount: maskAmount(cert.loanAmount),
    asOfDate: cert.asOfDate,
    issueDate: cert.issueDate,
  });

  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const passOk = /^[A-Z]{2}\d{7}$/.test(f.personPassport);
  const valid =
    f.personFullName.trim().length > 3 && passOk && f.contractNumber.trim() &&
    f.contractDate && unmaskAmount(f.loanAmount) && f.asOfDate && f.issueDate;

  async function save() {
    setBusy(true);
    setErr('');
    const res = await fetch(`/api/certificates/${cert.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, loanAmount: unmaskAmount(f.loanAmount) }),
    });
    if (res.ok) {
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
      <button onClick={() => setOpen(true)} className="btn-ghost w-full" type="button">
        <Ico.pen size={18} /> Tahrirlash
      </button>

      <Modal
        size="xl"
        open={open}
        title="Arizani tahrirlash"
        description="Tasdiqlagandan keyin tahrirlab boʻlmaydi. Mijoz maʼlumoti ham yangilanadi."
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)} type="button">Bekor</button>
            <button className="btn-primary" disabled={!valid || busy} onClick={save} type="button">
              {busy ? 'Saqlanmoqda…' : 'Saqlash'}
            </button>
          </>
        }
      >
        {err && <p className="mb-3 text-sm text-rose-600 dark:text-rose-300">{err}</p>}

        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
          <TextField
            label="F.I.SH. (kirillcha)" required value={f.personFullName} onChange={set('personFullName')}
            placeholder="ЖЎРАБЕКОВА ШАХЗОДАБЕГИМ ..."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Passport / ID" required value={f.personPassport} onChange={set('personPassport')}
              mask={maskPassport} placeholder="AE5348993"
              error={f.personPassport && !passOk ? '2 harf + 7 raqam' : undefined}
            />
            <TextField label="Kim tomonidan berilgan" value={f.passportIssuedBy} onChange={set('passportIssuedBy')} />
            <DateField label="Berilgan sana" value={f.passportIssuedAt} onChange={set('passportIssuedAt')} />
            <TextField label="Shartnoma raqami" required value={f.contractNumber} onChange={set('contractNumber')} inputMode="numeric" />
            <DateField label="Shartnoma sanasi" required value={f.contractDate} onChange={set('contractDate')} />
            <TextField label="Shartnoma turi" value={f.contractType} onChange={set('contractType')} />
            <TextField
              label="Kredit summasi" required value={f.loanAmount} onChange={set('loanAmount')}
              mask={maskAmount} inputMode="numeric" suffix="soʻm"
            />
            <DateField label="Holat sanasi" required value={f.asOfDate} onChange={set('asOfDate')} />
            <DateField label="Maʼlumotnoma sanasi" required value={f.issueDate} onChange={set('issueDate')} />
          </div>
        </div>
      </Modal>
    </>
  );
}
