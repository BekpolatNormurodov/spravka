import { afterEach, describe, expect, it } from 'vitest';
import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EditableText, EditableValue } from './DocumentEdit';

afterEach(cleanup);

const noop = () => {};

/** A slot wired to real state, the way the editor wires it. */
function TextHarness({ start = '' }: { start?: string }) {
  const [v, setV] = useState(start);
  return (
    <>
      <EditableText label="Ism" value={v} onChange={setV} onUndo={noop} onRedo={noop} placeholder="Ф.И.Ш." />
      {/* A second copy, because the name prints in three places and all of them show one value. */}
      <EditableText label="Ism 2" value={v} onChange={setV} onUndo={noop} onRedo={noop} placeholder="Ф.И.Ш." />
      <output data-testid="state">{v}</output>
    </>
  );
}

function ValueHarness({ kind, start = '' }: { kind: 'passport' | 'amount' | 'date' | 'text'; start?: string }) {
  const [v, setV] = useState(start);
  return (
    <>
      <EditableValue label="Qiymat" kind={kind} value={v} display={v} onChange={setV} placeholder="—" />
      <output data-testid="state">{v}</output>
    </>
  );
}

/** contenteditable has no `value`; typing into it means editing the DOM and firing `input`. */
function type(el: HTMLElement, text: string) {
  el.textContent = text;
  fireEvent.input(el);
}

describe('typing into the document', () => {
  it('keeps what was typed into a contenteditable slot', () => {
    render(<TextHarness />);
    const [first] = screen.getAllByRole('textbox');
    type(first!, 'КАМБАРОВА');
    expect(screen.getByTestId('state').textContent).toBe('КАМБАРОВА');
    expect(first!.textContent).toBe('КАМБАРОВА');
  });

  it('carries the value to the other places the same field prints', () => {
    render(<TextHarness />);
    const boxes = screen.getAllByRole('textbox');
    type(boxes[0]!, 'АЗИЗ');
    expect(boxes[1]!.textContent).toBe('АЗИЗ');
  });

  it('keeps typing on the second keystroke', () => {
    // The failure this is here for: one character lands, the node re-renders, and everything
    // after it is thrown away.
    render(<TextHarness />);
    const [box] = screen.getAllByRole('textbox');
    type(box!, 'А');
    type(box!, 'АЗ');
    type(box!, 'АЗИ');
    expect(screen.getByTestId('state').textContent).toBe('АЗИ');
    expect(box!.textContent).toBe('АЗИ');
  });

  it('puts the caret in an empty slot when it is clicked', () => {
    // The bug this exists for: an empty inline contenteditable is a box browsers will not focus
    // on click. The name slots sat there refusing every keystroke while the masked inputs beside
    // them worked, which read as "editing is broken".
    render(<TextHarness />);
    const [box] = screen.getAllByRole('textbox');
    fireEvent.mouseDown(box!);
    expect(document.activeElement).toBe(box);
  });

  it('leaves caret placement alone once there is text to click into', () => {
    render(<TextHarness start="КАМБАРОВА МОХИРА" />);
    const [box] = screen.getAllByRole('textbox');
    const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    box!.dispatchEvent(ev);
    // Not cancelled: clicking mid-name has to land mid-name, not at the start of it.
    expect(ev.defaultPrevented).toBe(false);
  });

  it('opens a click-to-edit value and keeps what is typed', () => {
    render(<ValueHarness kind="text" />);
    fireEvent.click(screen.getByRole('button', { name: 'Qiymat' }));
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '8130' } });
    expect(screen.getByTestId('state').textContent).toBe('8130');
  });

  it('masks a passport as it is typed', () => {
    render(<ValueHarness kind="passport" />);
    fireEvent.click(screen.getByRole('button', { name: 'Qiymat' }));
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ae5348993' } });
    expect(screen.getByTestId('state').textContent).toBe('AE5348993');
  });
});

describe('date entry', () => {
  it('dots the digits itself', () => {
    render(<ValueHarness kind="date" />);
    fireEvent.click(screen.getByRole('button', { name: 'Qiymat' }));
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '27102024' } });
    expect(input.value).toBe('27.10.2024');
    expect(screen.getByTestId('state').textContent).toBe('2024-10-27');
  });

  it('accepts the dots when they are typed too', () => {
    render(<ValueHarness kind="date" />);
    fireEvent.click(screen.getByRole('button', { name: 'Qiymat' }));
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '27.10.2024' } });
    expect(input.value).toBe('27.10.2024');
    expect(screen.getByTestId('state').textContent).toBe('2024-10-27');
  });

  it('stops at a full date instead of writing past it', () => {
    render(<ValueHarness kind="date" />);
    fireEvent.click(screen.getByRole('button', { name: 'Qiymat' }));
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '271020249999' } });
    expect(input.value).toBe('27.10.2024');
  });

  it('holds a partial date without inventing one', () => {
    render(<ValueHarness kind="date" />);
    fireEvent.click(screen.getByRole('button', { name: 'Qiymat' }));
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2710' } });
    expect(input.value).toBe('27.10');
    expect(screen.getByTestId('state').textContent).toBe('');
  });

  it('shows an existing date the way it is read, not the way it is stored', () => {
    render(<ValueHarness kind="date" start="2026-05-14" />);
    fireEvent.click(screen.getByRole('button', { name: 'Qiymat' }));
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('14.05.2026');
  });
});
