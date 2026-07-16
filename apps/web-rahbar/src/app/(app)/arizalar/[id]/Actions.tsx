'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, Ico, Spinner } from '@spravka/shared/ui';

type Dialog = null | 'sign' | 'return' | 'delete';
type Action = 'sign' | 'return' | 'delete';

export function Actions({
  id,
  status,
  number,
  personFullName,
}: {
  id: string;
  status: string;
  number: string;
  personFullName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | ''>('');
  const [err, setErr] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [note, setNote] = useState('');
  const [signed, setSigned] = useState(false);

  async function act(action: Action, noteText?: string) {
    setBusy(action);
    setErr('');
    try {
      const res = await fetch(`/api/certificates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: noteText }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error || `Xatolik (${res.status}). Qaytadan urinib koʻring.`);
        return;
      }
      setDialog(null);
      setNote('');
      if (action === 'sign') setSigned(true);
      if (action === 'delete') router.push('/imzolash');
      router.refresh();
    } catch {
      // Without this the promise rejects unhandled, `busy` never clears, and the button stays
      // dead until a reload — the worst way to fail, because it looks like the click worked.
      setErr('Serverga ulanib boʻlmadi. Internetni tekshirib, qaytadan urinib koʻring.');
    } finally {
      setBusy('');
    }
  }

  const open = (d: Exclude<Dialog, null>) => {
    setNote('');
    setErr('');
    setDialog(d);
  };

  /** Errors belong wherever the user is looking — inside the open dialog, not behind it. */
  const Err = ({ where }: { where: Dialog }) =>
    err && dialog === where ? (
      <p role="alert" className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
        {err}
      </p>
    ) : null;

  return (
    <div className="space-y-2">
      <Err where={null} />

      {signed && status === 'SIGNED' && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg bg-accent-600/10 px-3 py-2 text-sm font-medium text-accent-600 dark:text-accent-400"
        >
          <Ico.check size={16} />
          Imzolandi — hujjat QR orqali ochiq
        </p>
      )}

      {status === 'DIRECTOR_REVIEW' && (
        <>
          <button onClick={() => open('sign')} disabled={!!busy} className="btn-primary w-full">
            <Ico.pen size={18} />
            Imzolash
          </button>
          <button onClick={() => open('return')} disabled={!!busy} className="btn-ghost w-full">
            <Ico.chevron size={18} className="rotate-180" />
            Adminga qaytarish
          </button>
        </>
      )}

      <button onClick={() => open('delete')} disabled={!!busy} className="btn-danger w-full">
        <Ico.archive size={18} />
        Oʻchirish (arxiv)
      </button>

      {/*
        Signing had no confirmation at all, while archiving — which is reversible — had one. It is
        the other way round: this is the rahbar's signature, it cannot be taken back, and the
        document goes public the moment it lands. The dialog states which document, so the answer
        to "are you sure" is something the rahbar can actually check.
      */}
      <Modal
        open={dialog === 'sign'}
        title="Maʼlumotnomani imzolash"
        description="Imzolangandan keyin hujjatni tahrirlab ham, imzoni qaytarib ham boʻlmaydi."
        onClose={() => setDialog(null)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setDialog(null)} type="button" disabled={busy === 'sign'}>
              Bekor
            </button>
            <button className="btn-primary" disabled={busy === 'sign'} onClick={() => act('sign')} type="button">
              {busy === 'sign' ? <Spinner size={16} /> : <Ico.pen size={16} />}
              {busy === 'sign' ? 'Imzolanmoqda…' : 'Imzolash'}
            </button>
          </>
        }
      >
        <Err where="sign" />
        <dl className="space-y-1.5 rounded-xl bg-surface-2 px-4 py-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Maʼlumotnoma</dt>
            <dd className="font-mono tabular-nums">{number}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Jismoniy shaxs</dt>
            <dd className="text-right font-medium">{personFullName}</dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-muted">
          Hujjat sizning imzoyingiz bilan chiqadi va QR koddan skanerlagan har kim uni koʻra oladi.
        </p>

        {/*
          Says what is true about *this system*, not about the rahbar's machine. E-IMZO Client may
          well be installed and running — that is not what is missing. What is missing is our side:
          verifying an O'zDSt 1092:2009 signature needs E-IMZO-SERVER and a NIC contract, so the
          system does not use the key even when it is right there. An earlier wording said
          "E-IMZO: faol emas", which read as "your client is off" and was simply false.
        */}
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
          <span className="mt-px shrink-0 text-amber-600 dark:text-amber-400" aria-hidden>
            <Ico.shieldOff size={16} />
          </span>
          <div className="text-xs leading-relaxed">
            <p className="font-semibold text-fg">Davlat ЭЦП si qoʻyilmaydi</p>
            <p className="mt-0.5 text-muted">
              Kompyuteringizda E-IMZO oʻrnatilgan boʻlsa ham, tizim hozircha undan foydalanmaydi.
              Hujjat tizim tartibida imzolanadi, haqiqiyligi QR kod orqali tekshiriladi.
            </p>
          </div>
        </div>

        {busy === 'sign' && (
          <p className="mt-3 text-xs text-muted">Hujjat PDF qilinmoqda — bir necha soniya oladi.</p>
        )}
      </Modal>

      <Modal
        open={dialog === 'return'}
        title="Adminga qaytarish"
        description="Xato boʻlsa sababni yozing — admin va yurist shu izohni koʻradi va tuzatib qayta yuboradi."
        onClose={() => setDialog(null)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setDialog(null)} type="button" disabled={busy === 'return'}>
              Bekor
            </button>
            <button
              className="btn-primary"
              disabled={!note.trim() || busy === 'return'}
              onClick={() => act('return', note.trim())}
              type="button"
            >
              {busy === 'return' && <Spinner size={16} />}
              {busy === 'return' ? 'Yuborilmoqda…' : 'Qaytarish'}
            </button>
          </>
        }
      >
        <Err where="return" />
        <label className="field-label" htmlFor="return-note">Sabab / izoh *</label>
        <textarea
          id="return-note"
          className="field-input min-h-[110px] resize-y"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Masalan: F.I.SH. xato yozilgan. Toʻgʻrilab qayta yuboringlar."
          autoFocus
        />
        {!note.trim() && <p className="mt-1.5 text-xs text-muted">Sabab majburiy.</p>}
      </Modal>

      <Modal
        open={dialog === 'delete'}
        title="Arizani oʻchirish"
        description="Ariza arxivga koʻchadi. Sabab majburiy."
        onClose={() => setDialog(null)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setDialog(null)} type="button" disabled={busy === 'delete'}>
              Bekor
            </button>
            <button
              className="btn-danger"
              disabled={!note.trim() || busy === 'delete'}
              onClick={() => act('delete', note.trim())}
              type="button"
            >
              {busy === 'delete' && <Spinner size={16} />}
              {busy === 'delete' ? 'Oʻchirilmoqda…' : 'Oʻchirish'}
            </button>
          </>
        }
      >
        <Err where="delete" />
        <label className="field-label" htmlFor="delete-note">Oʻchirish sababi *</label>
        <textarea
          id="delete-note"
          className="field-input min-h-[90px] resize-y"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Sababni yozing…"
          autoFocus
        />
      </Modal>
    </div>
  );
}
