'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, Ico } from '@spravka/shared/ui';

export function Actions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [dialog, setDialog] = useState(false);
  const [note, setNote] = useState('');

  async function act(action: 'approve' | 'return', noteText?: string) {
    setBusy(action);
    setErr('');
    const res = await fetch(`/api/certificates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, note: noteText }),
    });
    if (res.ok) {
      setDialog(false);
      setNote('');
      router.refresh();
      setBusy('');
    } else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || 'Xatolik');
      setBusy('');
    }
  }

  return (
    <div className="space-y-2">
      {err && <div className="text-sm text-rose-600 dark:text-rose-300">{err}</div>}

      <button onClick={() => act('approve')} disabled={!!busy} className="btn-primary w-full">
        <Ico.check size={18} />
        {busy === 'approve' ? 'Tasdiqlanmoqda…' : 'Tasdiqlash → Rahbarga'}
      </button>

      <button onClick={() => setDialog(true)} disabled={!!busy} className="btn-danger w-full">
        <Ico.close size={18} />
        Qaytarish / rad etish
      </button>

      <Modal
        open={dialog}
        title="Yuristga qaytarish"
        description="Sababni yozing — yurist shu izohni koʻrib, tuzatib qayta yuboradi."
        onClose={() => setDialog(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setDialog(false)} type="button">Bekor</button>
            <button
              className="btn-primary"
              disabled={!note.trim() || busy === 'return'}
              onClick={() => act('return', note.trim())}
              type="button"
            >
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
          placeholder="Masalan: Shartnoma sanasi notoʻgʻri, 15.04.2026 boʻlishi kerak. Tuzatib qayta yuboring."
          autoFocus
        />
        {!note.trim() && <p className="mt-1.5 text-xs text-muted">Sabab majburiy.</p>}
      </Modal>
    </div>
  );
}
