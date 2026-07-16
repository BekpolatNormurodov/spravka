'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function Actions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  async function act(action: 'sign' | 'return' | 'delete', reason?: string) {
    setBusy(action);
    setErr('');
    const res = await fetch(`/api/certificates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason }),
    });
    if (res.ok) {
      if (action === 'delete') router.push('/imzolash');
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || 'Xatolik');
      setBusy('');
    }
  }

  function onDelete() {
    const reason = window.prompt('Oʻchirish sababi (majburiy):');
    if (reason && reason.trim()) act('delete', reason.trim());
  }

  return (
    <div className="space-y-2">
      {err && <div className="text-sm text-red-400">{err}</div>}
      {status === 'DIRECTOR_REVIEW' && (
        <>
          <button onClick={() => act('sign')} disabled={!!busy} className="btn-primary w-full">
            {busy === 'sign' ? 'Imzolanmoqda…' : '✍  Imzolash'}
          </button>
          <button onClick={() => act('return')} disabled={!!busy} className="btn-ghost w-full">
            {busy === 'return' ? 'Qaytarilmoqda…' : 'Adminга qaytarish'}
          </button>
        </>
      )}
      <button onClick={onDelete} disabled={!!busy} className="btn w-full border border-red-500/30 text-red-300 hover:bg-red-500/10">
        {busy === 'delete' ? 'Oʻchirilmoqda…' : 'Oʻchirish (arxiv)'}
      </button>
    </div>
  );
}
