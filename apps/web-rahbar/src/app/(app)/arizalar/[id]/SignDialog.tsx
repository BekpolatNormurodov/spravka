'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Modal, Ico, Spinner, Select,
  probeEimzo, loadKey, createPkcs7, unloadKey, EimzoError,
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

/**
 * E-IMZO reports a closed password window as an error («Ввод пароля отменен»). It is not one —
 * the rahbar chose to stop — and showing it in red as a failure would say something went wrong
 * when nothing did. Matched on E-IMZO's own wording in both languages it uses.
 */
const isCancelled = (m: string) => /отмен|bekor|cancel/i.test(m);

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
  const [denyReason, setDenyReason] = useState('');

  const probe = useCallback(async () => {
    setStatus('checking');
    setErr('');
    setDenyReason('');
    const r = await probeEimzo();
    if (r.status === 'ready') {
      setKeys(r.keys);
      setAlias(r.keys.length === 1 ? r.keys[0]!.alias : '');
    } else if (r.status === 'domain-denied') {
      setDenyReason(r.reason);
    }
    setStatus(r.status);
  }, []);

  useEffect(() => {
    if (open) void probe();
  }, [open, probe]);

  async function sign() {
    const key = keys.find((k) => k.alias === alias);
    if (!key) return;
    setErr('');
    let keyId: string | null = null;
    let challengeId: string | null = null;

    /*
      The stage is tracked here as well as in state, and the local is what the failure report
      uses. `step` is a closure over the render that started this call, so it reads `null` in the
      catch no matter how far we actually got — the log said "stage: unknown" for every failure,
      which is precisely the field worth having.
    */
    let stage: NonNullable<Step> = 'preparing';
    const at = (s: NonNullable<Step>) => {
      stage = s;
      setStep(s);
    };

    try {
      // 1. The server renders the document and tells us exactly which bytes to sign. It keeps
      //    the digest, so a signature can never be filed against bytes it does not cover.
      at('preparing');
      const prep = await fetch(`/api/certificates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sign-prepare' }),
      });
      const prepData = await prep.json().catch(() => ({}));
      if (!prep.ok) throw new Error(prepData.error || 'Hujjat tayyorlanmadi');
      challengeId = prepData.challengeId ?? null;

      // 2. E-IMZO opens its own password window. Nothing about it is ours — which is precisely
      //    why the password never reaches this page.
      at('unlocking');
      keyId = await loadKey(key);

      at('signing');
      const pkcs7 = await createPkcs7(prepData.pdfBase64, keyId);

      // 3. Only the finished signature crosses back.
      at('saving');
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
      const raw =
        e instanceof EimzoError ? e.message : e instanceof Error ? e.message : 'Kutilmagan xatolik';
      const message = isCancelled(raw)
        ? 'Parol kiritilmadi — imzolash bekor qilindi. Qaytadan urinib koʻring.'
        : raw;
      setErr(message);

      // Tell the server it failed. Everything E-IMZO refuses — a wrong password, a closed
      // dialog, a denied domain — happens in the browser and would otherwise leave nothing
      // behind: a rahbar reporting "it will not sign" and a server log with no trace of them
      // ever trying. Nothing is written to the certificate; only the attempt is recorded, and
      // the challenge is dropped so the rendered PDF cannot be completed later.
      //
      // `raw`, not `message`: the log gets E-IMZO's own words. The softened wording above is for
      // the rahbar; rewriting it in the log would hide what actually happened from whoever has
      // to diagnose it.
      void fetch(`/api/certificates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sign-error', challengeId, stage, error: raw }),
      }).catch(() => {
        /* reporting a failure must not itself become a failure the rahbar sees */
      });
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

        {/* Theirs to fix: the app is not open. */}
        {status === 'not-running' && (
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

        {/*
          Ours to fix, and the opposite message. E-IMZO is running and refusing this site because
          the domain has no API-KEY from the centre — restarting anything achieves nothing, so do
          not send the rahbar to fix the one part that works. «Qayta tekshirish» is deliberately
          absent for the same reason.
        */}
        {status === 'domain-denied' && (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5">
            <span className="mt-px shrink-0 text-rose-600 dark:text-rose-400" aria-hidden>
              <Ico.shieldOff size={16} />
            </span>
            <div className="text-xs leading-relaxed">
              <p className="font-semibold text-fg">E-IMZO bu saytga ruxsat bermadi</p>
              <p className="mt-0.5 text-muted">
                Dastur ishlayapti — muammo sizda emas. Saytga E-IMZO markazidan domen kaliti
                olinmagan. Buni tizim maʼmuri hal qiladi.
              </p>
              {denyReason && <p className="mt-1.5 font-mono text-[11px] text-muted">{denyReason}</p>}
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
