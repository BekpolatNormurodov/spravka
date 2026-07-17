'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, Ico, FilePicker } from '@spravka/shared/ui';

type Dialog = '' | 'approve' | 'return';

export function Actions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [dialog, setDialog] = useState<Dialog>('');
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  function close() {
    setDialog('');
    setNote('');
    setFiles([]);
    setErr('');
  }

  async function act(action: 'approve' | 'return') {
    setBusy(action);
    setErr('');
    // Multipart, not JSON: the message and its files belong to one workflow event, so they
    // travel in one request rather than an upload followed by a separate action.
    const body = new FormData();
    body.append('action', action);
    body.append('note', note.trim());
    for (const f of files) body.append('files', f);

    const res = await fetch(`/api/certificates/${id}`, { method: 'PATCH', body });
    setBusy('');
    if (res.ok) {
      close();
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || 'Xatolik');
    }
  }

  return (
    <div className="space-y-2">
      {err && !dialog && <div className="text-sm text-rose-600 dark:text-rose-300">{err}</div>}

      <button onClick={() => setDialog('approve')} disabled={!!busy} className="btn-primary w-full">
        <Ico.check size={18} />
        Tasdiqlash → Rahbarga
      </button>

      <button onClick={() => setDialog('return')} disabled={!!busy} className="btn-danger w-full">
        <Ico.close size={18} />
        Qaytarish / rad etish
      </button>

      <Modal
        size="lg"
        open={dialog === 'approve'}
        title="Rahbarga yuborish"
        description="Xabar va fayl qoldirishingiz mumkin — rahbar imzolashdan oldin shularni koʻradi. Majburiy emas."
        onClose={close}
        footer={
          <>
            <button className="btn-ghost" onClick={close} type="button">Bekor</button>
            <button className="btn-primary" disabled={busy === 'approve'} onClick={() => act('approve')} type="button">
              {busy === 'approve' ? 'Yuborilmoqda…' : 'Tasdiqlash va yuborish'}
            </button>
          </>
        }
      >
        {err && <p className="mb-3 text-sm text-rose-600 dark:text-rose-300">{err}</p>}
        <label className="field-label" htmlFor="approve-note">Rahbarga xabar</label>
        <textarea
          id="approve-note"
          className="field-input min-h-[100px] resize-y"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Masalan: Shartnomalar tekshirildi, qarzdorlik yopilgan. Bank maʼlumotnomasi biriktirildi."
          autoFocus
        />
        <div className="mt-4">
          <FilePicker files={files} onChange={setFiles} disabled={busy === 'approve'} />
        </div>
      </Modal>

      <Modal
        size="lg"
        open={dialog === 'return'}
        title="Yuristga qaytarish"
        description="Sababni yozing — yurist shu izohni koʻrib, tuzatib qayta yuboradi."
        onClose={close}
        footer={
          <>
            <button className="btn-ghost" onClick={close} type="button">Bekor</button>
            <button
              className="btn-primary"
              disabled={!note.trim() || busy === 'return'}
              onClick={() => act('return')}
              type="button"
            >
              {busy === 'return' ? 'Yuborilmoqda…' : 'Qaytarish'}
            </button>
          </>
        }
      >
        {err && <p className="mb-3 text-sm text-rose-600 dark:text-rose-300">{err}</p>}
        <label className="field-label" htmlFor="return-note">Sabab / izoh *</label>
        <textarea
          id="return-note"
          className="field-input min-h-[100px] resize-y"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Masalan: Shartnoma sanasi notoʻgʻri, 15.04.2026 boʻlishi kerak. Tuzatib qayta yuboring."
          autoFocus
        />
        {!note.trim() && <p className="mt-1.5 text-xs text-muted">Sabab majburiy.</p>}
        <div className="mt-4">
          <FilePicker files={files} onChange={setFiles} disabled={busy === 'return'} />
        </div>
      </Modal>
    </div>
  );
}
