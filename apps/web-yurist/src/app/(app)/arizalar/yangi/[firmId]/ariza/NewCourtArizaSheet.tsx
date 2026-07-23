'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isValidPinfl } from '@spravka/shared/core';
import {
  ArizaSheetEditor, useDraft, arizaDraftContracts, defaultArizaDraft,
  type ArizaDraft, type CertFirm, type ClientLookup, type SaveAction,
} from '@spravka/shared/ui';

const today = () => new Date().toISOString().slice(0, 10);

export function NewCourtArizaSheet({
  firm,
  nextNumber,
}: {
  firm: CertFirm & { id: string };
  nextNumber: string;
}) {
  const router = useRouter();
  const store = useDraft<ArizaDraft>(defaultArizaDraft(today()), `spravka.draft.new-ariza.${firm.id}`);
  const { draft, patch } = store;
  const [lookup, setLookup] = useState<ClientLookup>({ state: 'idle' });

  // The register number embeds the year, so it moves when the issue date crosses one.
  const [number, setNumber] = useState(nextNumber);
  useEffect(() => {
    if (draft.issueDate === today()) { setNumber(nextNumber); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/certificates/next-number?type=ariza&date=${draft.issueDate}`);
        const d = await res.json();
        if (!cancelled && d.number) setNumber(d.number);
      } catch {
        // Keep the last one; the real number is issued on save regardless.
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [draft.issueDate, nextNumber]);

  // A known debtor fills in what the ariza says about them, so repeat filings stay consistent.
  useEffect(() => {
    if (!isValidPinfl(draft.personPinfl)) { setLookup({ state: 'idle' }); return; }
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
            personAddress: d.client.address ?? '',
            personPhone: d.client.phone ?? '',
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
    // `patch` is stable by design — see useDraft.
  }, [draft.personPinfl, patch]);

  async function save(action: 'draft' | 'submit') {
    const res = await fetch('/api/certificates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        docType: 'ARIZA',
        ...draft,
        firmId: firm.id,
        contracts: arizaDraftContracts(draft),
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
    { label: 'Qoralama saqlash', busyLabel: 'Saqlanmoqda…', run: () => save('draft'), requiresValid: true },
    {
      label: 'Admin tasdigʻiga yuborish',
      busyLabel: 'Yuborilmoqda…',
      run: () => save('submit'),
      primary: true,
      requiresValid: true,
    },
  ];

  return (
    <ArizaSheetEditor
      firm={firm}
      number={number}
      store={store}
      actions={actions}
      requirePinfl
      onPinflChange={(v) => patch({ personPinfl: v })}
      lookup={lookup}
      title="Yangi ariza — Savdo-sanoat palatasiga"
      subtitle={firm.letterheadName || firm.name}
    />
  );
}
