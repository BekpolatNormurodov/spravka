'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, Ico } from '@spravka/shared/ui';

type Dialog = null | 'return' | 'delete';

export function Actions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [note, setNote] = useState('');

  async function act(action: 'sign' | 'return' | 'delete', noteText?: string) {
    setBusy(action);
    setErr('');
    const res = await fetch(`/api/certificates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, note: noteText }),
    });
    if (res.ok) {
      setDialog(null);
      setNote('');
      if (action === 'delete') router.push('/imzolash');
      router.refresh();
      setBusy('');
    } else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || 'Xatolik');
      setBusy('');
    }
  }

  const open = (d: Exclude<Dialog, null>) => {
    setNote('');
    setErr('');
    setDialog(d);
  };

  return (
    <div className="space-y-2">
      {err && <div className="text-sm text-rose-600 dark:text-rose-300">{err}</div>}

      {status === 'DIRECTOR_REVIEW' && (
        <>
          <button onClick={() => act('sign')} disabled={!!busy} className="btn-primary w-full">
            <Ico.pen size={18} />
            {busy === 'sign' ? 'Imzolanmoqda…' : 'Imzolash'}
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

      <Modal
        open={dialog === 'return'}
        title="Adminga qaytarish"
        description="Xato boʻlsa sababni yozing — admin va yurist shu izohni koʻradi va tuzatib qayta yuboradi."
        onClose={() => setDialog(null)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setDialog(null)} type="button">Bekor</button>
            <button className="btn-primary" disabled={!note.trim() || busy === 'return'} onClick={() => act('return', note.trim())} type="button">
              {busy === 'return' ? 'Yuborilmoqda…' : 'Qaytarish'}
            </button>
          </>
        }
      >
        <label className="field-label">Sabab / izoh *</label>
        <textarea
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
            <button className="btn-ghost" onClick={() => setDialog(null)} type="button">Bekor</button>
            <button className="btn-danger" disabled={!note.trim() || busy === 'delete'} onClick={() => act('delete', note.trim())} type="button">
              {busy === 'delete' ? 'Oʻchirilmoqda…' : 'Oʻchirish'}
            </button>
          </>
        }
      >
        <label className="field-label">Oʻchirish sababi *</label>
        <textarea
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
