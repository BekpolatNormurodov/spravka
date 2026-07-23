# «Savdo-sanoat palatasiga ariza» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second, court-petition document type («Savdo-sanoat palatasiga ariza») that shares the maʼlumotnoma pipeline via a `docType` discriminator.

**Architecture:** Extend the `Certificate` model with `docType` + nullable ariza columns (Approach A). A new `CourtArizaDocument` renders the Latin, two-page petition on screen and in the PDF, using the same render-prop editing pattern and the same workflow/signing/QR/public infrastructure the maʼlumotnoma already has.

**Tech Stack:** Next.js 14 App Router (× web-yurist/admin/rahbar/public), Prisma + MySQL, React, TypeScript, vitest (node + happy-dom), Chromium PDF via `pdf/render`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-23-savdo-sanoat-palatasiga-ariza-design.md` — the measured blueprint in §4.1 is the source of truth for layout.
- The document is **Latin Uzbek** (the maʼlumotnoma is Cyrillic). Keep the maʼlumotnoma's Cyrillic helpers untouched; add Latin siblings.
- **1:1 with the blank.** Keep source wording verbatim, including quirks («bankning moliyaviy xolatiga», «xududiy»).
- Repo is **public** — never commit passwords/secrets. `.env` is untouched.
- Do **not** touch the qrcode subsystem or run `docker system prune`.
- One component for screen and PDF; editors arrive via **render props**, never imported into the document (keeps `@spravka/shared/pdf` browser-free).
- Chamber identity is a **code constant**, not DB.
- `debtTotal` is a stored field, auto-summed in the editor but overridable.
- After the schema task, `npm run db:push` must be run (the user runs it on the server too).
- Verify per package with `npx tsc --noEmit -p tsconfig.json`; tests with `npm test` in `@spravka/shared`.

---

## Phase A — Foundation (core, no UI)

### Task 1: Schema — `docType` + ariza columns

**Files:**
- Modify: `packages/shared/prisma/schema.prisma`

**Interfaces:**
- Produces: `enum DocType { MALUMOTNOMA ARIZA }`; `Certificate.docType`, `.courtName`, `.interestRate`, `.personAddress`, `.personPhone`, `.debtPrincipal`, `.debtTermInterest`, `.debtOverduePrincipal`, `.debtOverdueInterest`, `.debtTotal`, `.chamberSignerPosition`, `.chamberSignerName`, `.chamberExecutorName`, `.chamberExecutorPhone`; `Certificate.personPassport` and `Client.passport` become nullable.

- [ ] **Step 1: Add the enum** after the `CertStatus` enum block:

```prisma
enum DocType {
  MALUMOTNOMA
  ARIZA
}
```

- [ ] **Step 2: Add columns to `Certificate`.** After the `infoRecipient` field add:

```prisma
  /// Which document this row is. Everything issued before this field existed is a maʼlumotnoma.
  docType          DocType @default(MALUMOTNOMA)

  // ── «Savdo-sanoat palatasiga ariza» fields (null on a maʼlumotnoma) ─────────────────────
  /// Full court addressee, e.g. «Fuqarolik ishlari boʻyicha Uchtepa tumanlararo sudiga».
  courtName        String?
  /// Yearly rate as typed ('54'); printed with a '%'.
  interestRate     String?
  /// Debtor address + phone, snapshotted like the person fields.
  personAddress    String?
  personPhone      String?
  /// Qarzdorlik taqsimoti — stored with tiyin.
  debtPrincipal        Decimal? @db.Decimal(18, 2)
  debtTermInterest     Decimal? @db.Decimal(18, 2)
  debtOverduePrincipal Decimal? @db.Decimal(18, 2)
  debtOverdueInterest  Decimal? @db.Decimal(18, 2)
  /// Jami — auto-summed in the editor, stored, overridable.
  debtTotal            Decimal? @db.Decimal(18, 2)
  /// The palata's signer + executor. Defaults live in the UI, not here.
  chamberSignerPosition String?
  chamberSignerName     String?
  chamberExecutorName   String?
  chamberExecutorPhone  String?
```

- [ ] **Step 3: Widen `Certificate.personPassport`** from `String` to `String?`:

```prisma
  personPassport   String?
```

- [ ] **Step 4: Widen `Client.passport`** from `String` to `String?`:

```prisma
  passport         String?
```

- [ ] **Step 5: Push the schema and regenerate the client**

Run: `cd packages/shared && npm run db:push`
Expected: Prisma reports the columns added / made nullable; client regenerated. (Nullable widening and defaulted-enum add are non-destructive — existing rows get `docType = MALUMOTNOMA`.)

- [ ] **Step 6: Commit**

```bash
git add packages/shared/prisma/schema.prisma
git commit -m "feat(ariza): add docType discriminator and ariza columns to Certificate"
```

---

### Task 2: Latin date helpers

**Files:**
- Modify: `packages/shared/src/core/document.ts`
- Test: `packages/shared/src/core/document.test.ts`

**Interfaces:**
- Consumes: `UZ_MONTHS_LAT` from `../ui/Calendar`? No — core must not import ui. Define Latin months locally in `document.ts`.
- Produces: `UZ_MONTHS_LATIN: readonly string[]`; `uzLongDateLatin(date: Date): string` → «2026 yil 15 iyul»; `uzLongDateLatinToIso(text: string): string` (inverse; '' when not a whole day); `arizaHeaderDate(date: Date): string` → «"15"  iyul 2026-yil».

- [ ] **Step 1: Write failing tests** in `document.test.ts`:

```ts
import { uzLongDateLatin, uzLongDateLatinToIso, arizaHeaderDate } from './document';

describe('Latin long dates', () => {
  const d = new Date(Date.UTC(2026, 6, 15)); // 15 July 2026
  it('formats long-form', () => expect(uzLongDateLatin(d)).toBe('2026 yil 15 iyul'));
  it('round-trips', () => expect(uzLongDateLatinToIso('2026 yil 15 iyul')).toBe('2026-07-15'));
  it('is forgiving of case/spacing', () =>
    expect(uzLongDateLatinToIso('  2026  YIL 1 Yanvar ')).toBe('2026-01-01'));
  it('rejects a non-day', () => expect(uzLongDateLatinToIso('2026 yil 31 fevral')).toBe(''));
  it('formats the header date', () => expect(arizaHeaderDate(d)).toBe('"15"  iyul 2026-yil'));
});
```

- [ ] **Step 2: Run to verify fail** — Run: `npm test -- document` · Expected: FAIL (not exported).

- [ ] **Step 3: Implement** in `document.ts` (mirror `uzLongDate`/`uzLongDateToIso`, Latin months, nominative):

```ts
export const UZ_MONTHS_LATIN = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
] as const;

export function uzLongDateLatin(date: Date): string {
  return `${date.getUTCFullYear()} yil ${date.getUTCDate()} ${UZ_MONTHS_LATIN[date.getUTCMonth()]}`;
}

export function uzLongDateLatinToIso(text: string): string {
  const m = /^\s*(\d{4})\s*yil\s*(\d{1,2})\s*([a-zʻ']+)\s*$/i.exec(text.trim());
  if (!m) return '';
  const year = Number(m[1]);
  const day = Number(m[2]);
  const month = UZ_MONTHS_LATIN.findIndex((n) => n === m[3]!.toLowerCase());
  if (month < 0 || day < 1 || year < 1900 || year > 2999) return '';
  const d = new Date(Date.UTC(year, month, day));
  if (d.getUTCDate() !== day || d.getUTCMonth() !== month) return '';
  return d.toISOString().slice(0, 10);
}

export function arizaHeaderDate(date: Date): string {
  return `"${date.getUTCDate()}"  ${UZ_MONTHS_LATIN[date.getUTCMonth()]} ${date.getUTCFullYear()}-yil`;
}
```

- [ ] **Step 4: Run to verify pass** — Run: `npm test -- document` · Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/core/document.ts packages/shared/src/core/document.test.ts
git commit -m "feat(ariza): Latin long-date helpers"
```

---

### Task 3: Decimal money formatting

**Files:**
- Modify: `packages/shared/src/core/document.ts` (beside `formatSum`)
- Test: `packages/shared/src/core/document.test.ts`

**Interfaces:**
- Produces: `formatSumDecimal(value: string): string` — «24318882.63» → «24 318 882,63», «24900000» → «24 900 000»; `maskAmountDecimal(v: string): string` (editor input: space thousands, one comma, ≤2 decimals); `unmaskAmountDecimal(v: string): string` → dot-decimal string for the API/Decimal («24 318 882,63» → «24318882.63»).

- [ ] **Step 1: Write failing tests:**

```ts
import { formatSumDecimal, unmaskAmountDecimal, maskAmountDecimal } from './document';

describe('decimal money', () => {
  it('groups and comma-decimals', () => expect(formatSumDecimal('24318882.63')).toBe('24 318 882,63'));
  it('whole → no comma', () => expect(formatSumDecimal('24900000')).toBe('24 900 000'));
  it('unmasks to dot-decimal', () => expect(unmaskAmountDecimal('24 318 882,63')).toBe('24318882.63'));
  it('masks progressively', () => expect(maskAmountDecimal('24318882,6')).toBe('24 318 882,6'));
  it('caps to two decimals', () => expect(maskAmountDecimal('1,239')).toBe('1,23'));
});
```

- [ ] **Step 2: Run to verify fail** — Run: `npm test -- document` · Expected: FAIL.

- [ ] **Step 3: Implement:**

```ts
/** Group an integer string with spaces: '24318882' -> '24 318 882'. */
function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** '24318882.63' | '24318882,63' -> '24 318 882,63'; whole -> no comma. */
export function formatSumDecimal(value: string): string {
  const s = String(value).replace(/\s/g, '').replace(',', '.');
  const [int = '0', frac] = s.split('.');
  const grouped = groupThousands(int.replace(/\D/g, '') || '0');
  return frac && Number(frac) !== 0 ? `${grouped},${frac.replace(/\D/g, '').slice(0, 2)}` : grouped;
}

/** Editor input: keep digits + one comma, ≤2 decimals, space-group the integer part. */
export function maskAmountDecimal(v: string): string {
  const cleaned = v.replace(/[^\d,]/g, '');
  const [int = '', ...rest] = cleaned.split(',');
  const frac = rest.join('').slice(0, 2);
  const grouped = groupThousands(int.replace(/^0+(?=\d)/, ''));
  return cleaned.includes(',') ? `${grouped},${frac}` : grouped;
}

/** '24 318 882,63' -> '24318882.63' (dot decimal for Prisma.Decimal). */
export function unmaskAmountDecimal(v: string): string {
  const s = v.replace(/\s/g, '').replace(',', '.');
  const [int = '0', frac] = s.split('.');
  const cleanInt = int.replace(/\D/g, '') || '0';
  return frac ? `${cleanInt}.${frac.replace(/\D/g, '').slice(0, 2)}` : cleanInt;
}
```

- [ ] **Step 4: Run to verify pass** — Run: `npm test -- document` · Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/core/document.ts packages/shared/src/core/document.test.ts
git commit -m "feat(ariza): decimal money formatting with tiyin"
```

---

### Task 4: Ariza numbering

**Files:**
- Modify: `packages/shared/src/core/numbering.ts`
- Modify: `packages/shared/src/db/cert-number.ts`
- Test: `packages/shared/src/core/numbering.test.ts`

**Interfaces:**
- Produces: `formatArizaNumber(seq: number): string` → «0001/09-02» (4-digit pad + fixed dept code); `arizaCounterId(year: number): string` → `ariza:{year}`; `nextArizaNumber(issueDate: Date): Promise<{ seq; number }>` and `peekArizaNumber(issueDate: Date): Promise<string>` in `cert-number.ts`.
- **Open item (spec §9):** register is per-year running. If the user confirms a different scheme, change only `formatArizaNumber` + `arizaCounterId`.

- [ ] **Step 1: Write failing test** in `numbering.test.ts`:

```ts
import { formatArizaNumber, arizaCounterId } from './numbering';

describe('ariza numbering', () => {
  it('pads to 4 digits with the dept code', () => expect(formatArizaNumber(1)).toBe('0001/09-02'));
  it('keeps longer sequences', () => expect(formatArizaNumber(1234)).toBe('1234/09-02'));
  it('keys the counter per year', () => expect(arizaCounterId(2026)).toBe('ariza:2026'));
});
```

- [ ] **Step 2: Run to verify fail** — Run: `npm test -- numbering` · Expected: FAIL.

- [ ] **Step 3: Implement in `numbering.ts`:**

```ts
/** Ariza register number: «NNNN/09-02» (4-digit min pad; '09-02' is the fixed department code). */
export function formatArizaNumber(seq: number): string {
  return `${String(seq).padStart(4, '0')}/09-02`;
}

/** Counter row id for the ariza register — a per-year running sequence. */
export function arizaCounterId(year: number): string {
  return `ariza:${year}`;
}
```

- [ ] **Step 4: Implement in `cert-number.ts`** (atomic upsert, mirror `nextCertNumber`):

```ts
import { arizaCounterId, formatArizaNumber } from '../core/numbering';

/** Allocate the next ariza register number for the issue year. Never reused. */
export async function nextArizaNumber(issueDate: Date): Promise<{ seq: number; number: string }> {
  const id = arizaCounterId(issueDate.getUTCFullYear());
  const counter = await prisma.counter.upsert({
    where: { id },
    create: { id, value: 1 },
    update: { value: { increment: 1 } },
  });
  return { seq: counter.value, number: formatArizaNumber(counter.value) };
}

/** What the next ariza number would be, without taking it. */
export async function peekArizaNumber(issueDate: Date): Promise<string> {
  const counter = await prisma.counter.findUnique({
    where: { id: arizaCounterId(issueDate.getUTCFullYear()) },
    select: { value: true },
  });
  return formatArizaNumber((counter?.value ?? 0) + 1);
}
```

- [ ] **Step 5: Run to verify pass** — Run: `npm test -- numbering` · Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/core/numbering.ts packages/shared/src/db/cert-number.ts packages/shared/src/core/numbering.test.ts
git commit -m "feat(ariza): per-year register numbering «NNNN/09-02»"
```

---

### Task 5: CHAMBER constant + logo asset

**Files:**
- Create: `packages/shared/src/core/chamber.ts`
- Create: `packages/shared/src/ui/chamber-logo.data.ts` (generated)
- Modify: `packages/shared/src/core/index.ts` (already `export * from './...'`? add `export * from './chamber'`)

**Interfaces:**
- Produces: `CHAMBER` (see spec §3); `CHAMBER_LOGO_DATA_URL: string` (base64 PNG data URI).

- [ ] **Step 1: Generate the logo data module** from the source blank's `word/media/image1.png`:

```bash
# From a copy of the .docx unzipped to /tmp/palata/unz (image is word/media/image1.png):
node -e "const fs=require('fs');const b=fs.readFileSync(process.argv[1]).toString('base64');fs.writeFileSync(process.argv[2],'// Generated from the source blank — O‘zbekiston Savdo-sanoat palatasi logo (1570×338).\nexport const CHAMBER_LOGO_DATA_URL =\n  \x27data:image/png;base64,'+b+'\x27;\n');" \
  /path/to/unz/word/media/image1.png packages/shared/src/ui/chamber-logo.data.ts
```

- [ ] **Step 2: Write `core/chamber.ts`:**

```ts
/** The one Tashkent branch of the Chamber of Commerce, as the ariza blank prints it. Code constant,
 *  not DB — there is a single branch. Promote to a settings row if a second one ever appears. */
export const CHAMBER = {
  branchName: 'Toshkent shahar hududiy boshqarmasi',
  contact: [
    'Toshkent sh., A.Temur shox koʻchasi, 4-uy',
    'tel. +99895 144 24 00, +99895 144 27 00',
    'e-mail: th@chamber.uz, www.chamber.uz',
  ],
  applicantName: 'Oʻzbekiston Savdo-sanoat palatasi Toshkent shahar xududiy boshqarmasi',
  applicantAddress: ['Toshkent shahar, Mirobod tumani,', 'A.Temur shox koʻchasi, 4-uy.'],
  applicantStir: '201 800 518',
  collectorLabel: ['Palata aʼzosi', 'manfaatida undiruvchi:'],
  attachments: [
    'Oʻz SSPga aʼzolik shartnomasi va guvoxnomasi nusxasi;',
    'Arizani imzolash vakolatini beruvchi ishonchnoma nusxasi;',
    'Kredit shartnomasi nusxasi;',
    'Ogohlantirish xatlari nusxasi;',
    'Kredit toʻlash grafigi nusxasi;',
    'Pochta xarajat toʻlanganligi haqida toʻlov topshiriqnoma.',
  ],
} as const;

/** Defaults for the palata's editable signer/executor — pre-filled so the common case is one save. */
export const CHAMBER_SIGNER = {
  position: 'Boshqarma boshligʻi oʻrinbosari',
  name: 'B.Babamuradov',
  executorName: 'B.Fayziyev',
  executorPhone: '+99895-144-24-00',
} as const;
```

- [ ] **Step 3: Export** — add `export * from './chamber';` to `core/index.ts`; add `export { CHAMBER_LOGO_DATA_URL } from './chamber-logo.data';` to `ui/index.ts`.

- [ ] **Step 4: Typecheck** — Run: `cd packages/shared && npx tsc --noEmit -p tsconfig.json` · Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/core/chamber.ts packages/shared/src/ui/chamber-logo.data.ts packages/shared/src/core/index.ts packages/shared/src/ui/index.ts
git commit -m "feat(ariza): CHAMBER constant + embedded palata logo"
```

---

### Task 6: Ariza field labels

**Files:**
- Modify: `packages/shared/src/core/labels.ts`

**Interfaces:**
- Produces: `CertField` union extended with `courtName | personAddress | personPhone | interestRate | debtPrincipal | debtTermInterest | debtOverduePrincipal | debtOverdueInterest | debtTotal | chamberSignerPosition | chamberSignerName | chamberExecutorName | chamberExecutorPhone`; `CERT_FIELD_LABELS` gains Uzbek labels for each.

- [ ] **Step 1: Extend the `CertField` union** with the ariza fields (append to the existing union).

- [ ] **Step 2: Add labels** to `CERT_FIELD_LABELS`:

```ts
  courtName: 'Sud nomi',
  personAddress: 'Qarzdor manzili',
  personPhone: 'Qarzdor telefoni',
  interestRate: 'Yillik foiz',
  debtPrincipal: 'Asosiy qarz qoldigʻi',
  debtTermInterest: 'Muddatli foizlar qarzdorligi',
  debtOverduePrincipal: 'Muddati oʻtgan qarz qarzdorligi',
  debtOverdueInterest: 'Muddati oʻtgan foizlar qarzdorligi',
  debtTotal: 'Jami qarzdorligi',
  chamberSignerPosition: 'Imzolovchi lavozimi',
  chamberSignerName: 'Imzolovchi',
  chamberExecutorName: 'Ijrochi',
  chamberExecutorPhone: 'Ijrochi telefoni',
```

- [ ] **Step 3: Typecheck** — `Record<CertField, string>` forces every new field to have a label. Run: `cd packages/shared && npx tsc --noEmit -p tsconfig.json` · Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/core/labels.ts
git commit -m "feat(ariza): field labels"
```

---

## Phase B — The document component

### Task 7: `CourtArizaDocument`

**Files:**
- Create: `packages/shared/src/ui/CourtArizaDocument.tsx`
- Modify: `packages/shared/src/ui/index.ts` (export it + its types)
- Test: `packages/shared/src/ui/court-ariza.test.tsx`

**Interfaces:**
- Consumes: `CertFirm` (from `CertificateDocument`), `CHAMBER`, `CHAMBER_LOGO_DATA_URL`, `formatSumDecimal`, `uzLongDateLatin`, `arizaHeaderDate`, `dmy`.
- Produces: `CourtArizaDocument(props: CourtArizaDocumentProps)`; `interface CourtArizaDocumentProps` (all the ariza print values + `firm: CertFirm`, `qrDataUrl?`, `edit?: CourtArizaEdit`); `interface CourtArizaEdit { text; value; contracts }` — same slot shape as `CertificateEdit` but over the ariza field names.

- [ ] **Step 1: Write the render test** (structure + that key values print). `court-ariza.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { CourtArizaDocument } from './CourtArizaDocument';

const firm = {
  name: '«BRIGHT FUTURE FINANCING MIKROMOLIYA TASHKILOTI» МЧЖ',
  letterheadName: '“BRIGHT FUTURE FINANCING MIKROMOLIYA TASHKILOTI” MMT MCHJ',
  directorName: 'A.A.', directorPosition: 'Direktor',
  address: 'Toshkent shahar, Olmazor tumani, Guruchariq MFY, Sagʻbon koʻchasi 30 berk, 7/1-uy',
  stir: '311 976 765', bankAccount: '20216000207212842001', mfo: '01183',
};
const props = {
  number: '0001/09-02', issueDate: new Date(Date.UTC(2026, 6, 15)),
  courtName: 'Fuqarolik ishlari boʻyicha Uchtepa tumanlararo sudiga',
  personFullName: 'Abdiyeva Muazzamxon Muxsin qizi',
  personPinfl: '61011006920020',
  personAddress: 'Fargʻona viloyati, Buvayda tumani',
  personPhone: '998952962728',
  contracts: [{ number: '22548', date: new Date(Date.UTC(2026, 3, 14)) }],
  contractType: 'ONLAYN', interestRate: '54', loanAmount: '24900000',
  asOfDate: new Date(Date.UTC(2026, 6, 15)), asOfText: '2026 yil 15 iyul',
  debtPrincipal: '24318882.63', debtTermInterest: '143914.49',
  debtOverduePrincipal: '577575.43', debtOverdueInterest: '2224630.19', debtTotal: '27265002.74',
  chamberSignerPosition: 'Boshqarma boshligʻi oʻrinbosari', chamberSignerName: 'B.Babamuradov',
  chamberExecutorName: 'B.Fayziyev', chamberExecutorPhone: '+99895-144-24-00',
  firm,
};

it('prints the debtor, court, firm and debt figures', () => {
  const html = renderToStaticMarkup(<CourtArizaDocument {...props} />);
  expect(html).toContain('Uchtepa tumanlararo sudiga');
  expect(html).toContain('Abdiyeva Muazzamxon Muxsin qizi');
  expect(html).toContain('61011006920020');
  expect(html).toContain('MMT MCHJ');            // firm printed via letterheadName (Latin)
  expect(html).toContain('24 318 882,63');       // decimal money
  expect(html).toContain('27 265 002,74');       // jami
  expect(html).toContain('A R I Z A');
  expect(html).toContain('S Oʻ R A Y M I Z');
  expect(html).toContain('54%');
});

it('is Latin — no Cyrillic maʼlumotnoma sentence leaks in', () => {
  const html = renderToStaticMarkup(<CourtArizaDocument {...props} />);
  expect(html).not.toContain('МАЪЛУМОТНОМА');
  expect(html).not.toContain('қарздорлиги мавжуд эмас');
});
```

- [ ] **Step 2: Run to verify fail** — Run: `npm test -- court-ariza` · Expected: FAIL (module missing).

- [ ] **Step 3: Implement `CourtArizaDocument.tsx`** following spec §4.1. Structure (fill each block; Times New Roman, `color:'#000'`, `.cert-sheet` wrapper, no max-height):

```tsx
import React from 'react';
import { dmy, formatSumDecimal, uzLongDateLatin, arizaHeaderDate, type DocContract } from '../core/document';
import { CHAMBER, CHAMBER_SIGNER } from '../core/chamber';
import { CHAMBER_LOGO_DATA_URL } from './chamber-logo.data';
import type { CertFirm } from './CertificateDocument';

// Latin contract list: «14.04.2026-yildagi 22548-sonli, …» (number NOT bold, unlike the maʼlumotnoma).
function ArizaContractList({ contracts }: { contracts: DocContract[] }) { /* map with ', ' joins */ }

export interface CourtArizaEdit {
  text: (field: 'courtName' | 'personFullName' | 'personAddress' | 'personPhone'
    | 'personPinfl' | 'contractType' | 'interestRate' | 'asOfText'
    | 'chamberSignerPosition' | 'chamberSignerName' | 'chamberExecutorName' | 'chamberExecutorPhone') => React.ReactNode;
  value: (field: 'issueDate' | 'loanAmount'
    | 'debtPrincipal' | 'debtTermInterest' | 'debtOverduePrincipal' | 'debtOverdueInterest' | 'debtTotal') => React.ReactNode;
  contracts: () => React.ReactNode;
}

export interface CourtArizaDocumentProps {
  number: string; issueDate: Date;
  courtName: string;
  personFullName: string; personPinfl: string; personAddress: string; personPhone: string;
  contracts: DocContract[]; contractType: string; interestRate: string; loanAmount: string;
  asOfDate: Date; asOfText?: string | null;
  debtPrincipal: string; debtTermInterest: string; debtOverduePrincipal: string;
  debtOverdueInterest: string; debtTotal: string;
  chamberSignerPosition: string; chamberSignerName: string;
  chamberExecutorName: string; chamberExecutorPhone: string;
  firm: CertFirm; qrDataUrl?: string; edit?: CourtArizaEdit;
}

export function CourtArizaDocument(p: CourtArizaDocumentProps) {
  const { firm, edit } = p;
  const firmName = firm.letterheadName || firm.name; // Latin form
  const money = (edit ? null : formatSumDecimal); // slots render their own display while editing
  // Build each region per the blueprint table (§4.1): letterhead (flex: logo left, CHAMBER.contact right),
  // header date/number (left), courtName (left bold), Arizachi block (label right + CHAMBER left),
  // collector block (CHAMBER.collectorLabel right + firm left, 12pt), Qarzdor block (label right +
  // editable debtor left), title, justified body paragraphs, the five debt lines, SOʻRAYMIZ, the two
  // request points, the attachments list, the signer line (space-between), ijrochi lines, and the QR
  // footer (same pattern as CertificateDocument, signed rows only).
  return (<div className="cert-sheet" style={{ fontFamily: '"Times New Roman", Times, serif', color: '#000' }}>{/* … */}</div>);
}
```

Rules to honor while filling it in:
- Every `p.xxx` that is editable renders `edit ? edit.text('xxx') : p.xxx` (text slots) or `edit ? edit.value('xxx') : formatSumDecimal(p.xxx)` (money) — exactly as `CertificateDocument` does, so the editing view and the print match.
- Money fields print via `formatSumDecimal`. `asOfText` falls back to `uzLongDateLatin(p.asOfDate)` when empty. Header date via `arizaHeaderDate`. Contract dates via `dmy`.
- `debtTotal` line: amount + « soʻm» bold.
- Signer line: flex `justifyContent:'space-between'` bold 14pt (position left, name right — leaves room for the wet signature).
- QR block: copy the footer JSX from `CertificateDocument` verbatim.

- [ ] **Step 4: Run to verify pass** — Run: `npm test -- court-ariza` · Expected: PASS.

- [ ] **Step 5: Export** — in `ui/index.ts` add `export { CourtArizaDocument } from './CourtArizaDocument';` and `export type { CourtArizaDocumentProps, CourtArizaEdit } from './CourtArizaDocument';`.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/ui/CourtArizaDocument.tsx packages/shared/src/ui/court-ariza.test.tsx packages/shared/src/ui/index.ts
git commit -m "feat(ariza): CourtArizaDocument — 1:1 Latin replica"
```

---

## Phase C — Editing

### Task 8: Generalise the draft history

**Files:**
- Modify: `packages/shared/src/ui/DocumentEdit.tsx`

**Interfaces:**
- Produces: generic `reduceDraft<T>`, `initialHistory<T>`, `useDraft<T>(initial, storageKey)` returning `DraftStore<T>`. Keep `useCertDraft = <>(...) => useDraft<CertDraft>(...)` and `CertDraftStore = DraftStore<CertDraft>` as thin aliases so nothing else changes.
- Consumes: nothing new.

- [ ] **Step 1: Parameterise the types.** Change `DraftHistory` → `DraftHistory<T>`, `DraftAction` → `DraftAction<T>`, `reduceDraft` → `reduceDraft<T>`, `initialHistory` → `initialHistory<T>`, `CertDraftStore` → `DraftStore<T>` with `patch: (p: Partial<T>, immediate?: boolean) => void`. The body is unchanged (it already only diffs `Object.keys` and shuffles arrays).

- [ ] **Step 2: Add the generic hook + keep the alias:**

```ts
export function useDraft<T>(initial: T, storageKey: string | null): DraftStore<T> { /* current useCertDraft body, T-generic */ }
export const useCertDraft = (initial: CertDraft, storageKey: string | null) => useDraft(initial, storageKey);
export type CertDraftStore = DraftStore<CertDraft>;
```

- [ ] **Step 3: Run the existing editor tests** — Run: `npm test -- editing document-edit` · Expected: PASS (behaviour identical).

- [ ] **Step 4: Typecheck** — Run: `cd packages/shared && npx tsc --noEmit -p tsconfig.json` · Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/ui/DocumentEdit.tsx
git commit -m "refactor: make the draft history generic over the document shape"
```

---

### Task 9: `ArizaDraft`, slots, validation

**Files:**
- Create: `packages/shared/src/ui/ArizaEdit.tsx`
- Modify: `packages/shared/src/ui/index.ts`
- Test: `packages/shared/src/ui/ariza-edit.test.tsx`

**Interfaces:**
- Consumes: `EditableText`, `EditableValue`, `EditableContracts`, `asDate`, `displayOf`-style helpers, `CourtArizaEdit`, `CERT_FIELD_LABELS`, `uzLongDateLatinToIso`, `unmaskAmountDecimal`, `formatSumDecimal`, `maskAmountDecimal`, `isValidDay`.
- Produces: `interface ArizaDraft`; `arizaEditSlots(draft, opts): CourtArizaEdit`; `arizaDraftProblems(d: ArizaDraft): DraftProblem[]`; `arizaDraftToApi(d)`; `previewContracts` reused from `DocumentEdit`; `DEFAULT_ARIZA_DRAFT` factory using `CHAMBER_SIGNER` + `contractType:'ONLAYN'`.

- [ ] **Step 1: Write the two key tests** — editing==printing, and validation. `ariza-edit.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { CourtArizaDocument } from './CourtArizaDocument';
import { arizaEditSlots, arizaDraftProblems, type ArizaDraft } from './ArizaEdit';

const full: ArizaDraft = {
  courtName: 'Fuqarolik ishlari boʻyicha Uchtepa tumanlararo sudiga',
  personFullName: 'Abdiyeva Muazzamxon Muxsin qizi', personPinfl: '61011006920020',
  personAddress: 'Fargʻona viloyati, Buvayda tumani', personPhone: '998952962728',
  contracts: [{ number: '22548', date: '2026-04-14' }],
  contractType: 'ONLAYN', interestRate: '54', loanAmount: '24900000',
  asOfDate: '2026-07-15', asOfText: '2026 yil 15 iyul',
  debtPrincipal: '24318882.63', debtTermInterest: '143914.49',
  debtOverduePrincipal: '577575.43', debtOverdueInterest: '2224630.19', debtTotal: '27265002.74',
  chamberSignerPosition: 'Boshqarma boshligʻi oʻrinbosari', chamberSignerName: 'B.Babamuradov',
  chamberExecutorName: 'B.Fayziyev', chamberExecutorPhone: '+99895-144-24-00',
  issueDate: '2026-07-15',
};

it('editing view prints the same values as the document', () => {
  const edit = arizaEditSlots(full, { patch() {}, undo() {}, redo() {}, invalid: () => false });
  const html = renderToStaticMarkup(<CourtArizaDocument {...docPropsFrom(full)} edit={edit} />);
  expect(html).toContain('Abdiyeva Muazzamxon Muxsin qizi');
  expect(html).toContain('24 318 882,63');
});

it('a full draft has no problems; an empty one flags each field once, in page order', () => {
  expect(arizaDraftProblems(full)).toEqual([]);
  const probs = arizaDraftProblems({ ...full, courtName: '', personFullName: '', debtTotal: '' });
  expect(probs.map((p) => p.field)).toEqual(expect.arrayContaining(['courtName', 'personFullName', 'debtTotal']));
});

it('does not require a passport', () => {
  expect(arizaDraftProblems(full).some((p) => p.field === 'personPassport')).toBe(false);
});
```

(Provide a small `docPropsFrom(draft)` helper in the test that maps ISO strings → Dates.)

- [ ] **Step 2: Run to verify fail** — Run: `npm test -- ariza-edit` · Expected: FAIL.

- [ ] **Step 3: Implement `ArizaEdit.tsx`** — `ArizaDraft` (all fields as strings/ISO like `CertDraft`), `arizaEditSlots` (mirror `certificateEditSlots`: `text` slots wrap `EditableText`; `value` slots wrap `EditableValue` with `kind:'amount'` using the decimal mask for the debt/loan fields and `kind:'date'` for issueDate; `contracts` reuses `EditableContracts`). `asOfText` slot re-parses via `uzLongDateLatinToIso` to keep `asOfDate` in step. The five debt `value` slots use a decimal-aware display (`formatSumDecimal`). `arizaDraftProblems` validates in page order (courtName, personFullName, personPinfl 14 digits, personAddress, personPhone, ≥1 contract valid, interestRate, loanAmount>0, asOfText Latin-parseable, four debt components ≥0, debtTotal>0, issueDate). No passport check. Include `DEFAULT_ARIZA_DRAFT(issueDate)` seeding `contractType:'ONLAYN'` and the `CHAMBER_SIGNER` defaults.

- [ ] **Step 4: Auto-sum helper** — export `arizaWithComputedTotal(d: ArizaDraft): ArizaDraft` that sets `debtTotal` to the summed four parts unless the user has overridden it. (The editor calls this on debt-field patches.)

- [ ] **Step 5: Run to verify pass** — Run: `npm test -- ariza-edit` · Expected: PASS.

- [ ] **Step 6: Export + commit**

```bash
git add packages/shared/src/ui/ArizaEdit.tsx packages/shared/src/ui/ariza-edit.test.tsx packages/shared/src/ui/index.ts
git commit -m "feat(ariza): ArizaDraft, edit slots, validation, auto-summed total"
```

---

### Task 10: `ArizaSheetEditor`

**Files:**
- Create: `packages/shared/src/ui/ArizaSheetEditor.tsx`
- Modify: `packages/shared/src/ui/index.ts`

**Interfaces:**
- Consumes: `useDraft<ArizaDraft>` store, `arizaEditSlots`, `arizaDraftProblems`, `arizaWithComputedTotal`, `CourtArizaDocument`, `CertFirm`, `SaveAction`, `ClientLookup`.
- Produces: `ArizaSheetEditor(props)` — the chrome around `CourtArizaDocument` (PINFL lookup, undo/redo, print-preview toggle, save bar, «Shartnoma» add). No «Sugʻurta» button. **No one-page overflow warning** (ariza is two pages). A debt block toolbar/section drives the five money fields; typing a component re-runs `arizaWithComputedTotal`.

- [ ] **Step 1:** Copy `CertSheetEditor` as the base; swap `CertificateDocument`→`CourtArizaDocument`, `certificateEditSlots`→`arizaEditSlots`, `draftProblems`→`arizaDraftProblems`; remove the «Sugʻurta» button and the `overflows` effect/warning; wire the debt fields through `arizaWithComputedTotal` on patch.

- [ ] **Step 2: Typecheck** — Run: `cd packages/shared && npx tsc --noEmit -p tsconfig.json` · Expected: clean.

- [ ] **Step 3: Export + commit**

```bash
git add packages/shared/src/ui/ArizaSheetEditor.tsx packages/shared/src/ui/index.ts
git commit -m "feat(ariza): ArizaSheetEditor chrome"
```

---

## Phase D — PDF

### Task 11: `courtArizaHtml` + branch the PDF builder

**Files:**
- Modify: `packages/shared/src/pdf/html.tsx`
- Modify: `packages/shared/src/pdf/ensure.ts`
- Test: `packages/shared/src/pdf/html.test.ts`

**Interfaces:**
- Produces: `courtArizaHtml(props: CourtArizaDocumentProps): string`; `buildCertificatePdf`/`ensureCertificatePdf` branch on `cert.docType` (`ARIZA` → `courtArizaHtml` + ariza prop mapping).

- [ ] **Step 1: Write failing test** in `html.test.ts`:

```ts
import { courtArizaHtml } from './html';
it('produces a standalone ariza document', () => {
  const html = courtArizaHtml(arizaProps); // reuse the Task 7 props fixture
  expect(html).toContain('<!doctype html>');
  expect(html).toContain('Uchtepa tumanlararo sudiga');
  expect(html).toContain('27 265 002,74');
  expect(html).not.toContain('src="http'); // self-contained (logo is a data: URI)
});
```

- [ ] **Step 2: Run to verify fail** — Run: `npm test -- html` · Expected: FAIL.

- [ ] **Step 3: Implement `courtArizaHtml`** in `html.tsx` (mirror `certificateHtml`, render `CourtArizaDocument`, same `SHEET_CSS`).

- [ ] **Step 4: Branch `ensure.ts`.** Widen `CertificateWithFirm` (already `Certificate & { firm; contracts }` — fine). In `buildCertificatePdf`, `if (cert.docType === 'ARIZA') return renderPdf(courtArizaHtml(arizaPropsFromRow(cert, qrDataUrl)))` else the existing path. Add `arizaPropsFromRow` mapping the row's decimals to strings.

- [ ] **Step 5: Run to verify pass** — Run: `npm test -- html` · Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/pdf/html.tsx packages/shared/src/pdf/ensure.ts packages/shared/src/pdf/html.test.ts
git commit -m "feat(ariza): render the ariza PDF, branched on docType"
```

---

## Phase E — API

### Task 12: Create + edit an ariza

**Files:**
- Modify: `apps/web-yurist/src/app/api/certificates/route.ts` (POST)
- Modify: `apps/web-yurist/src/app/api/certificates/[id]/route.ts` (PATCH)
- Modify: `apps/web-admin/src/app/api/certificates/[id]/route.ts` (PATCH)
- (Reference) `apps/web-yurist/src/app/api/certificates/next-number/route.ts` — add an ariza branch if it serves the peek number.

**Interfaces:**
- Consumes: `nextArizaNumber`, `unmaskAmountDecimal`, `DocType`.
- Produces: POST/PATCH accept `docType:'ARIZA'` and the ariza fields; ariza required set = `firmId, courtName, personPinfl, personFullName, personAddress, personPhone, loanAmount, asOfDate, issueDate` + the five debt fields; number from `nextArizaNumber`; `Client` upsert writes `fullName/address/phone` (no passport).

- [ ] **Step 1:** In the POST route, read `b.docType`. For `ARIZA`: validate the ariza required set (reuse `missingFieldsError`), upsert the client on PINFL with address/phone, allocate `nextArizaNumber(issueDate)`, and `prisma.certificate.create` with `docType: 'ARIZA'` and the ariza columns (decimals via `unmaskAmountDecimal`). Keep the maʼlumotnoma path as the `else`.

- [ ] **Step 2:** In both `[id]` PATCH routes, allow editing the ariza columns when the row's `docType === 'ARIZA'` (mirror the existing field-by-field update; decimals through `unmaskAmountDecimal`).

- [ ] **Step 3: Typecheck all touched apps** — Run per app: `npx tsc --noEmit -p tsconfig.json` · Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web-yurist/src/app/api apps/web-admin/src/app/api
git commit -m "feat(ariza): create and edit arizas via the certificates API"
```

---

## Phase F — Apps (yurist, admin, rahbar, public)

### Task 13: Creation flow — «Hujjat yaratish» → type → firm

**Files:**
- Modify: `apps/web-yurist/src/app/(app)/arizalar/yangi/[firmId]/page.tsx` (offer a type choice)
- Create: `apps/web-yurist/src/app/(app)/arizalar/yangi/[firmId]/ariza/page.tsx`
- Create: `apps/web-yurist/src/app/(app)/arizalar/yangi/[firmId]/ariza/NewArizaSheet.tsx`
- (Reference) `.../[firmId]/NewArizaSheet.tsx` and `.../yangi/page.tsx` — the maʼlumotnoma path becomes `.../[firmId]/malumotnoma` **or** stays default; pick one and keep the sidebar link working.

**Interfaces:**
- Consumes: `ArizaSheetEditor`, `useDraft<ArizaDraft>`, `DEFAULT_ARIZA_DRAFT`, `peekArizaNumber`, client-lookup route.
- Produces: a working «yangi ariza» sheet that POSTs `docType:'ARIZA'`.

- [ ] **Step 1:** After a firm is picked, show two cards — «Maʼlumotnoma» and «Savdo-sanoat palatasiga ariza» — linking to the two sub-routes. (Keep the current maʼlumotnoma sheet reachable exactly as before.)

- [ ] **Step 2:** Build `NewArizaSheet.tsx` by mirroring the maʼlumotnoma `NewArizaSheet`: seed `DEFAULT_ARIZA_DRAFT(today)`, host `ArizaSheetEditor`, wire PINFL lookup + save actions (Draft / Submit) hitting the POST route with `docType:'ARIZA'`.

- [ ] **Step 3:** Peek number via `peekArizaNumber`.

- [ ] **Step 4: Verify in browser** (preview_start `spravka-yurist`): create an ariza, check it lists and renders. Fix issues, re-check.

- [ ] **Step 5: Commit**

```bash
git add apps/web-yurist/src/app/(app)/arizalar/yangi
git commit -m "feat(ariza): «Hujjat yaratish» type picker + new ariza sheet"
```

---

### Task 14: Edit an ariza (yurist + admin)

**Files:**
- Modify: `apps/web-yurist/src/app/(app)/arizalar/[id]/tahrir/page.tsx` + `EditArizaSheet.tsx`
- Modify: `apps/web-admin/.../arizalar/[id]/tahrir/page.tsx` + its sheet

- [ ] **Step 1:** When the row's `docType === 'ARIZA'`, load the ariza fields into an `ArizaDraft` and render `ArizaSheetEditor`; else the existing maʼlumotnoma editor. PATCH with the ariza payload.
- [ ] **Step 2: Typecheck + browser check.**
- [ ] **Step 3: Commit** `feat(ariza): edit arizas (yurist + admin)`.

---

### Task 15: List — type badge + filter

**Files:**
- Modify: the arizalar list pages/components in `web-yurist`, `web-admin`, `web-rahbar` (`(app)/page.tsx` / list component) and `core/filters.ts` if the filter set is shared.

- [ ] **Step 1:** Show a «Hujjat turi» badge (Maʼlumotnoma / Ariza) per row and a type filter. Labels from a `DOC_TYPE_LABELS` map (add to `core/labels.ts`).
- [ ] **Step 2: Typecheck + browser check.**
- [ ] **Step 3: Commit** `feat(ariza): document-type badge and filter in the list`.

---

### Task 16: Detail pages — render branch

**Files:**
- Modify: `apps/web-yurist/.../arizalar/[id]/page.tsx`, `apps/web-admin/.../arizalar/[id]/page.tsx`, `apps/web-rahbar/.../arizalar/[id]/page.tsx`

- [ ] **Step 1:** Render `CourtArizaDocument` when `docType === 'ARIZA'`, else `CertificateDocument`. Map the row's decimals to strings. Rahbar's sign flow is unchanged (it signs the frozen PDF).
- [ ] **Step 2: Typecheck + browser check (rahbar sign path on an ariza).**
- [ ] **Step 3: Commit** `feat(ariza): render arizas on the detail pages`.

---

### Task 17: Public verification page — render branch

**Files:**
- Modify: `apps/web-public/src/app/m/[id]/page.tsx`

- [ ] **Step 1:** Branch on `docType` to render `CourtArizaDocument` for signed arizas; keep the public wording generic (or add an ariza title). QR/verify logic unchanged.
- [ ] **Step 2: Browser check** the public page for a signed ariza.
- [ ] **Step 3: Commit** `feat(ariza): public verification renders arizas`.

---

## Phase G — Verify

### Task 18: Isolation tests + full green

**Files:**
- Modify: `packages/shared/src/ui/court-ariza.test.tsx` (add the reverse-isolation assertion), `packages/shared/src/pdf/html.test.ts`.

- [ ] **Step 1:** Add a maʼlumotnoma-side assertion: `certificateHtml`/`CertificateDocument` output contains **no** ariza sentence («S Oʻ R A Y M I Z», «sudiga», «Palata aʼzosi»).
- [ ] **Step 2: Full suite** — Run: `cd packages/shared && npm test` · Expected: all pass (existing 185 + new).
- [ ] **Step 3: Typecheck every package** — Run `npx tsc --noEmit -p tsconfig.json` in `packages/shared`, `apps/web-yurist`, `apps/web-admin`, `apps/web-rahbar`, `apps/web-public` · Expected: clean. (Delete any stale `.next/types` dirs if a removed route lingers.)
- [ ] **Step 4:** Note in the final message: the user must run `npm run db:push` on the server for the new columns.
- [ ] **Step 5: Commit** `test(ariza): document-type isolation + full green`.

---

## Self-Review notes

- **Spec coverage:** §3 → Tasks 1,5,6; §4 → Tasks 2,3,7; §4.4 auto-sum → Task 9 step 4; §5 → Tasks 8,9,10; §6 → Tasks 11,12,16,17; §7 → Tasks 13,15; §8 → Tasks 7,9,18. All covered.
- **Open items** (spec §9): ariza number scheme (Task 4 — flagged, isolated), creation-picker layout (Task 13 — browser-verified). Confirm both with the user before/at execution.
- **Type consistency:** `CourtArizaEdit` field names match `ArizaDraft` keys and `CourtArizaDocumentProps`; `formatSumDecimal`/`unmaskAmountDecimal` used consistently screen↔API; `nextArizaNumber`/`formatArizaNumber` names stable across Tasks 4 and 12.
