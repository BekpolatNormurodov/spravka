'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Modal, Ico, Spinner, Select,
  eimzoAvailable, listKeys, loadKey, createPkcs7, unloadKey, EimzoError,
  type EimzoKey, type EimzoStatus, type Option,
} from '@spravka/shared/ui';

/** What the rahbar is waiting on. Signing is several seconds and several steps — say which. */
type Step = null | 'preparing' | 'unlocking' | 'signing' | 'saving';

/**
 * 'C:\' + 'DSKEYS' → 'C:\DSKEYS'. E-IMZO hands `disk` back with its separator already attached,
 * so appending another one printed 'C:\\DSKEYS'.
 *
 * The separator is whatever the *signer's* machine uses, not ours: E-IMZO ships for Linux and
 * macOS too, where a key lives under something like '/home/user' and a backslash would be
 * nonsense. Take it from the value rather than assuming Windows.
 */
function keyLocation(k: EimzoKey): string {
  // A key may sit in the drive root — E-IMZO allows an empty path — and 'E:' is not the root,
  // 'E:\' is.
  if (!k.path) return k.disk;
  // A drive letter means Windows even when the separator was trimmed off ('D:').
  const windows = k.disk.includes('\\') || /^[A-Za-z]:/.test(k.disk);
  const sep = windows ? '\\' : '/';
  return `${k.disk.replace(/[\\/]+$/, '')}${sep}${k.path}`;
}

const STEP_LABEL: Record<NonNullable<Step>, string> = {
  preparing: 'Hujjat PDF qilinmoqda…',
  unlocking: 'E-IMZO oynasida parolni kiriting…',
  signing: 'Imzolanmoqda…',
  saving: 'Saqlanmoqda…',
};

export function SignDialog({
  open,
  onClose,
  id,
  number,
  personFullName,
  onSigned,
}: {
  open: boolean;
  onClose: () => void;
  id: string;
  number: string;
  personFullName: string;
  onSigned: () => void;
}) {
  const [status, setStatus] = useState<EimzoStatus>('checking');
  const [keys, setKeys] = useState<EimzoKey[]>([]);
  const [alias, setAlias] = useState('');
  const [step, setStep] = useState<Step>(null);
  const [err, setErr] = useState('');

  const probe = useCallback(async () => {
    setStatus('checking');
    setErr('');
    if (!(await eimzoAvailable())) {
      setStatus('unavailable');
      return;
    }
    try {
      const found = await listKeys();
      setKeys(found);
      setAlias(found.length === 1 ? found[0]!.alias : '');
      setStatus('ready');
    } catch (e) {
      setStatus('unavailable');
      setErr(e instanceof EimzoError ? e.message : 'Kalitlarni oʻqib boʻlmadi');
    }
  }, []);

  useEffect(() => {
    if (open) void probe();
  }, [open, probe]);

  async function sign() {
    const key = keys.find((k) => k.alias === alias);
    if (!key) return;
    setErr('');
    let keyId: string | null = null;

    try {
      // 1. The server renders the document and tells us exactly which bytes to sign. It keeps
      //    the digest, so a signature can never be filed against bytes it does not cover.
      setStep('preparing');
      const prep = await fetch(`/api/certificates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sign-prepare' }),
      });
      const prepData = await prep.json().catch(() => ({}));
      if (!prep.ok) throw new Error(prepData.error || 'Hujjat tayyorlanmadi');

      // 2. E-IMZO opens its own password window. Nothing about it is ours — which is precisely
      //    why the password never reaches this page.
      setStep('unlocking');
      keyId = await loadKey(key);

      setStep('signing');
      const pkcs7 = await createPkcs7(prepData.pdfBase64, keyId);

      // 3. Only the finished signature crosses back.
      setStep('saving');
      const res = await fetch(`/api/certificates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sign-commit',
          challengeId: prepData.challengeId,
          pkcs7,
          signerInfo: { alias: key.alias, name: key.name, disk: key.disk },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Saqlanmadi (${res.status})`);

      onSigned();
    } catch (e) {
      setErr(
        e instanceof EimzoError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Kutilmagan xatolik',
      );
    } finally {
      if (keyId) void unloadKey(keyId);
      setStep(null);
    }
  }

  const busy = step !== null;
  const keyOptions: Option[] = keys.map((k) => ({
    value: k.alias,
    label: `${k.name} — ${keyLocation(k)}`,
  }));

  return (
    <Modal
      open={open}
      title="Maʼlumotnomani imzolash"
      description="Imzolangandan keyin hujjatni tahrirlab ham, imzoni qaytarib ham boʻlmaydi."
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} type="button" disabled={busy}>
            Bekor
          </button>
          <button
            className="btn-primary"
            type="button"
            disabled={busy || status !== 'ready' || !alias}
            onClick={sign}
          >
            {busy ? <Spinner size={16} /> : <Ico.pen size={16} />}
            {busy ? 'Imzolanmoqda…' : 'Imzolash'}
          </button>
        </>
      }
    >
      {err && (
        <p role="alert" className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
          {err}
        </p>
      )}

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

      <div className="mt-4">
        {status === 'checking' && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Spinner size={16} /> E-IMZO tekshirilmoqda…
          </p>
        )}

        {status === 'unavailable' && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
            <span className="mt-px shrink-0 text-amber-600 dark:text-amber-400" aria-hidden>
              <Ico.shieldOff size={16} />
            </span>
            <div className="text-xs leading-relaxed">
              <p className="font-semibold text-fg">E-IMZO dasturi ishga tushmagan</p>
              <p className="mt-0.5 text-muted">
                Kompyuteringizda E-IMZO ni oching va kalitingiz ulangan boʻlsin — kalit diskda
                yoki fleshkada boʻlishi mumkin, E-IMZO uni oʻzi topadi.
              </p>
              <button onClick={() => void probe()} type="button" className="mt-2 cursor-pointer text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400">
                Qayta tekshirish
              </button>
            </div>
          </div>
        )}

        {status === 'ready' && keys.length === 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed">
            <p className="font-semibold text-fg">Kalit topilmadi</p>
            <p className="mt-0.5 text-muted">
              E-IMZO ishlayapti, lekin kalit koʻrinmadi. Fleshkani ulang yoki kalit{' '}
              <span className="font-mono">DSKEYS</span> papkasida ekanini tekshiring.
            </p>
            <button onClick={() => void probe()} type="button" className="mt-2 cursor-pointer text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400">
              Qayta tekshirish
            </button>
          </div>
        )}

        {status === 'ready' && keys.length > 0 && (
          <>
            <Select
              label="Kalit"
              placeholder="Kalitni tanlang"
              value={alias}
              onChange={setAlias}
              options={keyOptions}
            />
            <p className="mt-1.5 text-xs text-muted">
              Tanlagach E-IMZO oʻz oynasida parol soʻraydi. Parol bu sahifaga kirmaydi.
            </p>
          </>
        )}
      </div>

      {/*
        Said plainly, because the rahbar is putting their name on a legal document and is entitled
        to know what it rests on. The signature below is real — made by their key, on their
        machine — but nobody has checked it: that needs E-IMZO-SERVER and a NIC contract.
      */}
      <p className="mt-3 text-xs leading-relaxed text-muted">
        Imzo hujjatga biriktiriladi va saqlanadi, lekin hozircha <b>tekshirilmaydi</b> — buning
        uchun davlat E-IMZO serveriga ulanish kerak. Hujjat haqiqiyligi QR kod orqali tasdiqlanadi.
      </p>

      {busy && <p className="mt-3 text-xs font-medium text-fg">{STEP_LABEL[step!]}</p>}
    </Modal>
  );
}
