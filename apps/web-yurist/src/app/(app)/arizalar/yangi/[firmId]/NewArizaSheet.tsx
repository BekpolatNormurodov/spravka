'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isValidPinfl, uzLongDate } from '@spravka/shared/core';
import {
  CertSheetEditor, useCertDraft, draftContracts,
  type CertDraft, type CertFirm, type ClientLookup, type SaveAction,
} from '@spravka/shared/ui';

const today = () => new Date().toISOString().slice(0, 10);

const blank = (): CertDraft => ({
  personPinfl: '',
  personFullName: '',
  personPassport: '',
  passportIssuedBy: '',
  passportIssuedAt: '',
  contracts: [{ number: '', date: '' }],
  contractType: '«Микроқарз» универсал шартномаси',
  loanAmount: '',
  asOfDate: today(),
  // The phrase is what prints, so it starts as today already written out — the yurist edits prose
  // rather than filling a date field that then turns into prose somewhere else.
  asOfText: uzLongDate(new Date(`${today()}T00:00:00.000Z`)),
  issueDate: today(),
});

export function NewArizaSheet({ firm }: { firm: CertFirm & { id: string } }) {
  const router = useRouter();
  // Per firm, so a draft started on one blank does not surface on another's.
  const store = useCertDraft(blank(), `spravka.draft.new.${firm.id}`);
  const { draft, patch } = store;
  const [lookup, setLookup] = useState<ClientLookup>({ state: 'idle' });

  // A known client fills in what the document says about them, so repeat arizas stay consistent
  // with each other rather than with whoever typed them fastest.
  useEffect(() => {
    if (!isValidPinfl(draft.personPinfl)) {
      setLookup({ state: 'idle' });
      return;
    }
    let cancelled = false;
    setLookup({ state: 'searching' });
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clients?pinfl=${draft.personPinfl}`);
        const d = await res.json();
        if (cancelled) return;
        if (d.found) {
          patch({
            personFullName: d.client.fullName,
            personPassport: d.client.passport,
            passportIssuedBy: d.client.passportIssuedBy ?? '',
            passportIssuedAt: d.client.passportIssuedAt
              ? String(d.client.passportIssuedAt).slice(0, 10)
              : '',
          }, true);
          setLookup({ state: 'found', previous: d.client._count?.certificates ?? 0 });
        } else {
          setLookup({ state: 'new' });
        }
      } catch {
        if (!cancelled) setLookup({ state: 'idle' });
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
    // `patch` is stable by design — see useCertDraft.
  }, [draft.personPinfl, patch]);

  async function save(action: 'draft' | 'submit') {
    const res = await fetch('/api/certificates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...draft,
        firmId: firm.id,
        contracts: draftContracts(draft),
        action,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || 'Saqlanmadi');
    }
    store.clearStored();
    router.push('/');
    router.refresh();
  }

  const actions: SaveAction[] = [
    { label: 'Qoralama saqlash', busyLabel: 'Saqlanmoqda…', run: () => save('draft') },
    {
      label: 'Admin tasdigʻiga yuborish',
      busyLabel: 'Yuborilmoqda…',
      run: () => save('submit'),
      primary: true,
      requiresValid: true,
    },
  ];

  return (
    <CertSheetEditor
      firm={firm}
      // Empty, so the № line is left off entirely: the counter issues the number at save time —
      // burning one on a document that may never be saved would leave gaps in the sequence — and
      // a placeholder standing in for it would look like a number the document does not have.
      number=""
      store={store}
      actions={actions}
      pinfl
      // Needed to submit, not to save a draft — the yurist often has the contract in hand and the
      // PINFL somewhere else, and the ariza is worth keeping in the meantime.
      requirePinfl
      onPinflChange={(v) => patch({ personPinfl: v })}
      lookup={lookup}
      title="Yangi maʼlumotnoma"
      subtitle={firm.letterheadName || firm.name}
    />
  );
}
