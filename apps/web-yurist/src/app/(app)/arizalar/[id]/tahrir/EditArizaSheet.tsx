'use client';

import { useRouter } from 'next/navigation';
import {
  CertSheetEditor, useCertDraft, draftContracts,
  type CertDraft, type CertFirm, type SaveAction,
} from '@spravka/shared/ui';

export function EditArizaSheet({
  id,
  number,
  firm,
  initial,
}: {
  id: string;
  number: string;
  firm: CertFirm;
  initial: CertDraft;
}) {
  const router = useRouter();
  const store = useCertDraft(initial, `spravka.draft.edit.${id}`);

  async function save() {
    const res = await fetch(`/api/certificates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...store.draft, contracts: draftContracts(store.draft) }),
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
    { label: 'Hujjatni saqlash', busyLabel: 'Saqlanmoqda…', run: save, primary: true, requiresValid: true },
  ];

  return (
    <CertSheetEditor
      firm={firm}
      number={number}
      store={store}
      actions={actions}
      // Shown so a draft saved without a PINFL can get one here — that is the edit that finally
      // links the ariza to the person. No lookup: the details are already on the sheet, and
      // autofilling over them would undo the correction they came to make.
      pinfl
      onPinflChange={(v) => store.patch({ personPinfl: v })}
      title="Hujjatni tahrirlash"
      subtitle={`№${number} · ${firm.letterheadName || firm.name}`}
    />
  );
}
