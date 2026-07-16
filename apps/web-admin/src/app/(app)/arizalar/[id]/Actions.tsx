'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function Actions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'' | 'approve' | 'return'>('');
  const [err, setErr] = useState('');

  async function act(action: 'approve' | 'return') {
    setBusy(action);
    setErr('');
    const res = await fetch(`/api/certificates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      router.refresh();
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
        {busy === 'approve' ? 'Tasdiqlanmoqda…' : 'Tasdiqlash → Rahbarga'}
      </button>
      <button onClick={() => act('return')} disabled={!!busy} className="btn-ghost w-full">
        {busy === 'return' ? 'Qaytarilmoqda…' : 'Yuristga qaytarish'}
      </button>
    </div>
  );
}
