import { describe, it, expect } from 'vitest';
import { MAX_FILE_BYTES, MAX_PER_ARIZA, attachmentError, safeExt } from './rules';
import { cleanName } from './intake';

const file = (name: string, type: string, size: number) => ({ name, type, size });

describe('attachmentError', () => {
  it('accepts what the roles actually send each other', () => {
    expect(attachmentError(file('skrinshot.png', 'image/png', 200_000))).toBeNull();
    expect(attachmentError(file('skaner.pdf', 'application/pdf', 1_000_000))).toBeNull();
    expect(
      attachmentError(
        file('hisob.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 50_000),
      ),
    ).toBeNull();
    expect(
      attachmentError(
        file('ariza.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 50_000),
      ),
    ).toBeNull();
  });

  it('refuses a type that is not on the list', () => {
    // An .exe or .svg reaching a viewer's browser is the whole reason there is a list.
    expect(attachmentError(file('virus.exe', 'application/x-msdownload', 100))).toContain('turi');
    expect(attachmentError(file('x.svg', 'image/svg+xml', 100))).toContain('turi');
    expect(attachmentError(file('x.html', 'text/html', 100))).toContain('turi');
  });

  it('refuses an oversized file', () => {
    expect(attachmentError(file('katta.png', 'image/png', MAX_FILE_BYTES + 1))).toContain('10 MB');
    expect(attachmentError(file('chegara.png', 'image/png', MAX_FILE_BYTES))).toBeNull();
  });

  it('refuses an empty file', () => {
    expect(attachmentError(file('bosh.png', 'image/png', 0))).toContain('boʻsh');
  });
});

describe('safeExt', () => {
  it('takes the extension from the mime type, not the name the client sent', () => {
    // The stored filename must not be steerable by the uploader.
    expect(safeExt('image/png', 'evil.php')).toBe('png');
    expect(safeExt('application/pdf', '../../etc/passwd')).toBe('pdf');
    expect(safeExt('image/jpeg', 'x.jpg')).toBe('jpg');
  });

  it('has an extension for every allowed type', () => {
    expect(safeExt('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'a')).toBe('xlsx');
    expect(safeExt('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'a')).toBe('docx');
    expect(safeExt('image/webp', 'a')).toBe('webp');
  });
});

describe('limits', () => {
  it('are the ones the UI promises', () => {
    expect(MAX_FILE_BYTES).toBe(10 * 1024 * 1024);
    expect(MAX_PER_ARIZA).toBe(10);
  });
});

describe('cleanName', () => {
  it('keeps a normal filename intact — digits and dots included', () => {
    // An earlier version used a character *range* by mistake and ate every digit and dot.
    expect(cleanName('skrinshot 2026-07-14.png')).toBe('skrinshot 2026-07-14.png');
    expect(cleanName('Hisob-faktura 12.xlsx')).toBe('Hisob-faktura 12.xlsx');
    expect(cleanName('Ҳисоб.pdf')).toBe('Ҳисоб.pdf');
  });

  it('drops directory parts', () => {
    expect(cleanName('C:\\Users\\x\\Desktop\\a.png')).toBe('a.png');
    expect(cleanName('../../etc/passwd')).toBe('passwd');
  });

  it('drops characters that mean something to a filesystem or a header', () => {
    expect(cleanName('a"b:c<d>e|f?g*h.png')).toBe('abcdefgh.png');
    expect(cleanName('a\r\nContent-Type: x.png')).toBe('aContent-Type x.png');
  });

  it('never returns an empty name', () => {
    expect(cleanName('')).toBe('fayl');
    expect(cleanName('///')).toBe('fayl');
    expect(cleanName('???')).toBe('fayl');
  });
});
