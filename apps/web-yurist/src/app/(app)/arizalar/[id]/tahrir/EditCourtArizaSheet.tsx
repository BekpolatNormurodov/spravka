'use client';

import { useRouter } from 'next/navigation';
import {
  ArizaSheetEditor, useDraft, arizaDraftContracts,
  type ArizaDraft, type CertFirm, type SaveAction,
} from '@spravka/shared/ui';

export function EditCourtArizaSheet({
  id,
  number,
  firm,
  initial,
}: {
  id: string;
  number: string;
  firm: CertFirm;
  initial: ArizaDraft;
}) {
  const router = useRouter();
  const store = useDraft<ArizaDraft>(initial, `spravka.draft.edit.${id}`);

  async function save() {
    const res = await fetch(`/api/certificates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docType: 'ARIZA', ...store.draft, contracts: arizaDraftContracts(store.draft) }),
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
    { label: 'Arizani saqlash', busyLabel: 'Saqlanmoqda…', run: save, primary: true, requiresValid: true },
  ];

  return (
    <ArizaSheetEditor
      firm={firm}
      number={number}
      store={store}
      actions={actions}
      requirePinfl
      onPinflChange={(v) => store.patch({ personPinfl: v })}
      title="Arizani tahrirlash"
      subtitle={`№${number} · ${firm.letterheadName || firm.name}`}
    />
  );
}
