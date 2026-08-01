'use client';

import { useRouter } from 'next/navigation';
import {
  IshonchnomaSheetEditor, useDraft,
  type PoaDraft, type CertFirm, type SaveAction,
} from '@spravka/shared/ui';

export function EditIshonchnomaSheet({
  id,
  number,
  firm,
  initial,
}: {
  id: string;
  number: string;
  firm: CertFirm;
  initial: PoaDraft;
}) {
  const router = useRouter();
  const store = useDraft<PoaDraft>(initial, `spravka.draft.edit.${id}`);

  async function save() {
    const res = await fetch(`/api/certificates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docType: 'ISHONCHNOMA', ...store.draft }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || 'Saqlanmadi');
    }
    store.clearStored();
    router.push(`/arizalar/${id}`);
    router.refresh();
  }

  const actions: SaveAction[] = [
    { label: 'Bekor qilish', busyLabel: '…', run: async () => router.push(`/arizalar/${id}`) },
    { label: 'Ishonchnomani saqlash', busyLabel: 'Saqlanmoqda…', run: save, primary: true, requiresValid: true },
  ];

  return (
    <IshonchnomaSheetEditor
      firm={firm}
      number={number}
      store={store}
      actions={actions}
      requirePinfl
      onPinflChange={(v) => store.patch({ personPinfl: v })}
      title="Ishonchnomani tahrirlash"
      subtitle={`№${number} · ${firm.letterheadName || firm.name}`}
    />
  );
}
