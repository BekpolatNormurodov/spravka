// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import React, { useMemo } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { useDraft } from './DocumentEdit';
import { poaEditSlots, defaultPoaDraft, type PoaDraft } from './IshonchnomaEdit';
import { PowerOfAttorneyDocument } from './PowerOfAttorneyDocument';
import type { CertFirm } from './CertificateDocument';

afterEach(cleanup);

const FIRM: CertFirm = {
  name: '"Prof Collector" МЧЖ',
  letterheadName: '"Prof Collector" масъулияти чекланган жамияти',
  shortName: 'Prof Collector',
  address: 'Тошкент',
  bankAccount: '2020', stir: '123', mfo: '00014', bankName: 'ANORBANK',
  directorPosition: 'Директор', directorName: 'A. Karimov',
} as CertFirm;

/**
 * The real editing path in miniature: useDraft → memoized poaEditSlots → the document, exactly the
 * way IshonchnomaSheetEditor wires it. The simple-useState harness in editing.test.tsx cannot catch
 * a remount caused by the whole document re-rendering and rebuilding `edit` on every keystroke — this
 * one can, because that is the path a clerk actually types on.
 */
function Harness({ start }: { start?: Partial<PoaDraft> }) {
  const store = useDraft<PoaDraft>({ ...defaultPoaDraft('2026-01-01'), ...start }, null);
  const edit = useMemo(
    () => poaEditSlots(store.draft, {
      patch: store.patch, undo: store.undo, redo: store.redo, invalid: () => false,
    }),
    [store.draft, store.patch, store.undo, store.redo],
  );
  return (
    <PowerOfAttorneyDocument
      number="1/2026"
      issueDate={new Date('2026-01-01')}
      personFullName={store.draft.personFullName}
      personPinfl={store.draft.personPinfl}
      personPassport={store.draft.personPassport}
      poaBankName={store.draft.poaBankName}
      poaContractDate={null}
      poaContractNumber={store.draft.poaContractNumber}
      poaValidUntil={null}
      firm={FIRM}
      edit={edit}
    />
  );
}

/** contenteditable has no `value`; typing into it means editing the DOM and firing `input`. */
function typeCE(el: HTMLElement, text: string) {
  el.textContent = text;
  fireEvent.input(el);
}

const slotBox = (root: HTMLElement, field: string) =>
  root.querySelector<HTMLElement>(`[data-slot="${field}"] [role="textbox"]`);

describe('ishonchnoma: typing through the whole document', () => {
  it('accumulates keystrokes into a contenteditable slot without dropping any', () => {
    const { container } = render(<Harness />);
    const box = slotBox(container, 'personFullName')!;
    typeCE(box, 'А');
    typeCE(box, 'АЗ');
    typeCE(box, 'АЗИ');
    expect(slotBox(container, 'personFullName')!.textContent).toBe('АЗИ');
  });

  it('keeps the SAME dom node across a keystroke — a remount is what steals the caret', () => {
    const { container } = render(<Harness />);
    const before = slotBox(container, 'personFullName')!;
    typeCE(before, 'А');
    const after = slotBox(container, 'personFullName')!;
    // Referential identity: if the whole-document re-render had rebuilt this slot as a fresh
    // element, React would have swapped the node and the browser caret would be gone with it.
    expect(after).toBe(before);
  });

  it('keeps a click-to-edit date input focused while its digits are typed', () => {
    const { container } = render(<Harness />);
    const btn = container.querySelector<HTMLButtonElement>('[data-slot="poaValidUntil"] button')!;
    fireEvent.click(btn);
    const input = container.querySelector<HTMLInputElement>('[data-slot="poaValidUntil"] input')!;
    input.focus();
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: '2710' } });
    fireEvent.change(input, { target: { value: '271020' } });
    fireEvent.change(input, { target: { value: '27102026' } });
    // The input the person is typing in is still there and still focused after the document
    // re-rendered on every change — not swapped for a fresh one that would drop focus.
    const still = container.querySelector<HTMLInputElement>('[data-slot="poaValidUntil"] input')!;
    expect(still).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(still.value).toBe('27.10.2026');
  });

  it('bank name typed in one place shows in both spots it prints', () => {
    const { container } = render(<Harness />);
    const box = slotBox(container, 'poaBankName')!;
    typeCE(box, 'ANOR');
    // The blank prints the bank twice; both slots read the one draft field.
    const both = container.querySelectorAll('[data-slot="poaBankName"] [role="textbox"]');
    expect(both.length).toBe(2);
    both.forEach((n) => expect(n.textContent).toBe('ANOR'));
  });
});
