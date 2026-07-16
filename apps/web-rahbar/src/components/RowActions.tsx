'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, Ico, RowAction, ViewAction, Spinner } from '@spravka/shared/ui';

/** Row actions for the rahbar lists: view + archive (archive needs a reason). */
export function RowActions({ id, number }: { id: string; number: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function archive() {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch(`/api/certificates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', note: note.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error || `Xatolik (${res.status}). Qaytadan urinib koʻring.`);
        return;
      }
      setOpen(false);
      setNote('');
      router.refresh();
    } catch {
      // A dropped connection must not leave the button spinning forever with no explanation.
      setErr('Serverga ulanib boʻlmadi. Internetni tekshirib, qaytadan urinib koʻring.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
      <ViewAction href={`/arizalar/${id}`} />
      <RowAction label="Arxivga oʻchirish" tone="danger" onClick={() => { setNote(''); setErr(''); setOpen(true); }}>
        <Ico.archive size={16} />
      </RowAction>

      <Modal
        open={open}
        title="Arizani arxivga oʻchirish"
        description={`№ ${number} — sabab majburiy.`}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)} type="button" disabled={busy}>Bekor</button>
            <button className="btn-danger" disabled={!note.trim() || busy} onClick={archive} type="button">
              {busy && <Spinner size={16} />}
              {busy ? 'Oʻchirilmoqda…' : 'Oʻchirish'}
            </button>
          </>
        }
      >
        {err && (
          <p role="alert" className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
            {err}
          </p>
        )}
        <label className="field-label" htmlFor={`archive-note-${id}`}>Oʻchirish sababi *</label>
        <textarea
          id={`archive-note-${id}`}
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
