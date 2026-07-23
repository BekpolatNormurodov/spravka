# «Savdo-sanoat palatasiga ariza» — a second document type

**Date:** 2026-07-23
**Status:** approved (design), ready to plan
**Source blank:** `Abdiyeva Muazzamxon Muxsin qizi.docx` (a court petition filed by the O‘zbekiston
Savdo-sanoat palatasi Toshkent shahar hududiy boshqarmasi on behalf of a member micro‑finance firm).

## 1. Goal

Add a **second document type** to the maʼlumotnoma system: a **court application (ariza) requesting a
court order (sud buyrug‘i)** to collect a debtor's overdue micro‑loan debt. It is filed by the Chamber
of Commerce (palata) on behalf of a member firm, addressed to a district court.

It is the semantic opposite of the existing maʼlumotnoma (which certifies **no** debt), but it flows
through the **same pipeline**: yurist writes → admin reviews → rahbar signs with E‑IMZO, with the same
QR + public verification. The creation entry becomes **«Hujjat yaratish»** offering two documents:
**«Maʼlumotnoma»** (existing) and **«Savdo-sanoat palatasiga ariza»** (new).

The document is a **1:1 replica** of the blank, **in Latin Uzbek** (the maʼlumotnoma is Cyrillic), and
runs to **two A4 pages**.

## 2. Non-goals

- No new roles, apps, or workflow. The three‑stage flow, E‑IMZO signing, QR, and public page are reused
  unchanged, branching on document type where they render.
- No migration of existing rows. Every existing `Certificate` becomes `docType = MALUMOTNOMA` by default.
- The chamber (palata) identity is **not** stored in the DB — it is one Tashkent branch, kept as a code
  constant. (Easy to promote to an admin‑editable settings row later if a second branch appears.)
- E‑IMZO verification stays out of scope, exactly as for the maʼlumotnoma (signing works; verification
  needs a NIC contract we don't have).

## 3. Data model — one table, discriminated by `docType` (Approach A)

Extend the existing `Certificate` model rather than forking the workflow subsystem. `WorkflowEvent`,
`CertSignature`, `SignChallenge`, `CertContract`, `Client`, numbering, PDF‑freeze, QR and the public page
are all keyed to `Certificate` and are reused as‑is.

### New enum

```prisma
enum DocType {
  MALUMOTNOMA   // the existing "qarzdorlik yo‘qligi" certificate
  ARIZA         // «Savdo-sanoat palatasiga ariza» — court petition
}
```

### `Certificate` — added columns (all nullable except the discriminator)

| Column | Type | Holds |
|---|---|---|
| `docType` | `DocType @default(MALUMOTNOMA)` | which document this row is |
| `courtName` | `String?` | full court addressee, e.g. «Fuqarolik ishlari boʻyicha Uchtepa tumanlararo sudiga» |
| `interestRate` | `String?` | yearly rate as typed, e.g. `54` (printed `54%`) |
| `personAddress` | `String?` | debtor address (snapshot) |
| `personPhone` | `String?` | debtor phone (snapshot) |
| `debtPrincipal` | `Decimal? @db.Decimal(18,2)` | Asosiy qarz qoldigʻi |
| `debtTermInterest` | `Decimal? @db.Decimal(18,2)` | Muddatli foizlar qarzdorligi |
| `debtOverduePrincipal` | `Decimal? @db.Decimal(18,2)` | Muddati oʻtgan qarz qarzdorligi |
| `debtOverdueInterest` | `Decimal? @db.Decimal(18,2)` | Muddati oʻtgan foizlar qarzdorligi |
| `debtTotal` | `Decimal? @db.Decimal(18,2)` | Jami qarzdorligi (see §4.4 — stored, auto‑summed in the editor) |
| `chamberSignerPosition` | `String?` | default «Boshqarma boshligʻi oʻrinbosari» |
| `chamberSignerName` | `String?` | default «B.Babamuradov» |
| `chamberExecutorName` | `String?` | default «B.Fayziyev» |
| `chamberExecutorPhone` | `String?` | default «+99895-144-24-00» |

### Widened columns (safe: every existing row already has a value)

- `Certificate.personPassport`: `String` → `String?`. An ariza debtor has a PINFL, address and phone, no
  passport. Validation makes passport required **only** for `MALUMOTNOMA`.
- `Client.passport`: `String` → `String?`. A client first seen through an ariza has no passport yet; it is
  filled the day they get a maʼlumotnoma. `Client` already has `address` and `phone`.

### Reused unchanged (both types)

`number`/`seq`/`issueDate`, `firm` + `firmSnapshot`, `status` + `WorkflowEvent`, `CertSignature` +
`SignChallenge` (E‑IMZO), `client` + `personPinfl`, `contracts` (`CertContract`), `loanAmount`
(= total credit issued, «jami … soʻm ajratilgan»), `asOfDate`/`asOfText`, `contractType` (= «ONLAYN»),
`pdfPath`/`pdfSha256`, QR, `scans`, `deletedAt`/`deletedById`/`deletedReason`, `createdBy`.

`infoRecipient` stays `null` for arizas (it is a maʼlumotnoma‑only line).

### The chamber constant

```ts
// packages/shared/src/core/chamber.ts (or ui/) — one Tashkent branch, code constant.
export const CHAMBER = {
  branchName: 'Toshkent shahar hududiy boshqarmasi',
  contact: ['Toshkent sh., A.Temur shox koʻchasi, 4-uy',
            'tel. +99895 144 24 00, +99895 144 27 00',
            'e-mail: th@chamber.uz, www.chamber.uz'],
  applicantName: 'Oʻzbekiston Savdo-sanoat palatasi Toshkent shahar xududiy boshqarmasi',
  applicantAddress: ['Toshkent shahar, Mirobod tumani,', 'A.Temur shox koʻchasi, 4-uy.'],
  applicantStir: '201 800 518',
} as const;
```

The logo (`word/media/image1.png`, 1570×338, prints at **70.9 mm × 25.1 mm**) is embedded as a base64
`data:` URI in a generated `packages/shared/src/ui/chamber-logo.data.ts` (mirrors `pdf/fonts.data.ts`),
so both the screen and the self‑contained PDF render it without a network fetch.

## 4. The document — `CourtArizaDocument`, a 1:1 replica

A new component beside `CertificateDocument`, same contract: one component for screen **and** PDF, with an
optional `edit?: CourtArizaEdit` render‑prop supplying editors (render props, not imports, so
`@spravka/shared/pdf` renders it under Node without a browser bundle). Times New Roman, sizes as measured:
`sz=28 → 14pt`, `26 → 13pt`, `24 → 12pt`, `20 → 10pt`. Page A4, margins **20 / 15 / 20 / 30 mm**
(top/right/bottom/left) — identical to the maʼlumotnoma, so the sheet CSS is shared; the ariza sheet has
**no max height** and grows onto page 2.

### 4.1 Blueprint (measured from the blank)

Legend: **K** = constant template text · **F** = from the firm row · **C** = from the CHAMBER constant ·
**✎** = editable per document · **QR** = our addition, signed rows only.

| # | Align | pt | Content | Source |
|---|---|---|---|---|
| Letterhead | logo left; text right | | logo + 4 right‑aligned lines | C |
| | right | 14 b | Toshkent shahar hududiy boshqarmasi | C |
| | right | 13 | Toshkent sh., A.Temur shox koʻchasi, 4-uy | C |
| | right | 13 | tel. +99895 144 24 00, +99895 144 27 00 | C |
| | right | 14 | e-mail: th@chamber.uz, www.chamber.uz | C |
| Date | left | 12 | «"DD"  MONTH YYYY-yil» | ✎ issueDate |
| Number | left | 12 | «№ {number}» (issued number already ends `/09-02`) | auto |
| Court | left | 14 b | courtName (may wrap 2 lines) | ✎ courtName |
| Arizachi: | right | 14 | label | K |
| | left | 14 b | applicantName | C |
| | left | 14 | applicantAddress (2 lines) + «STIR 201 800 518.» | C |
| Palata a'zosi manfaatida undiruvchi: | right | 14 | label (2 lines) | K |
| | left | 12 b | «"{FIRM}" MMT MCHJ» | F (letterheadName, Latin) |
| | left | 12 | «{address}. X/R: {bankAccount},» / «MFO: {mfo}, STIR: {stir}» | F |
| Qarzdor: | right | 14 | label | K |
| | left | 14 b | personFullName | ✎ |
| | left | 14 | personAddress | ✎ |
| | left | 14 | «JShShIR: {personPinfl}» | ✎ (PINFL) |
| | left | 10 | «Tel:  {personPhone}» | ✎ |
| Title | center | 14 b | «A R I Z A» | K |
| | center | 12 | «(Sud buyrugʻi berish haqida)» | K |
| Body ¶ | justify | 14 | legal preamble (Qonun 21-modda …) | K |
| | justify | 14 | «Ish hujjatlari oʻrganilganda quyidagilar maʼlum boʻldi:» | K |
| | justify | 14 | «{FIRM} va fuqaro oʻrtasida {contracts} "{contractType}" shartnomalariga asosan, yillik {rate}% ustama haq toʻlash sharti bilan jami {loanAmount} soʻm miqdorida kredit mablagʻi ajratilgan.» | F + ✎ contracts/contractType/interestRate/loanAmount |
| | justify | 14 | «Qarzdor tomonidan shartnomaga muvofiq …» | K |
| | justify | 14 | «Mikro moliya tashkiloti tomonidan qarzdorga …» | K |
| | justify | 14 | «Shunga koʻra, qarzdor … {asOfText} holatiga koʻra … qarzdorligi quyidagicha:» | ✎ asOfText |
| | justify | 14 | «Asosiy qarz qoldigʻi -  {debtPrincipal} soʻm;» | ✎ |
| | justify | 14 | «Muddatli foizlar qarzdorligi -  {debtTermInterest} soʻm;» | ✎ |
| | justify | 14 | «Muddati oʻtgan qarz qarzdorligi -  {debtOverduePrincipal} soʻm;» | ✎ |
| | justify | 14 | «Muddati oʻtgan foizlar qarzdorligi -  {debtOverdueInterest} soʻm;» | ✎ |
| | justify | 14 | «Jami qarzdorligi  **{debtTotal} soʻm**ni tashkil etadi.» (amount bold) | ✎/derived |
| | justify | 14 | «Shuningdek, qarzdor tomonidan … bankning moliyaviy xolatiga …» (source wording kept) | K |
| | justify | 14 | «Yuqorida keltirilganlariga hamda … Sizdan quyidagilarni» | K |
| | center | 14 | «S Oʻ R A Y M I Z:» | K |
| | justify | 14 | «1. Mazkur arizani davlat bojisiz ish yurituvingizga qabul qilishingizni;» | K |
| | justify | 14 | «2. Qarzdor **{personFullName}**dan "**{FIRM}**" MMT MCHJ foydasiga jami boʻlib **{debtTotal} soʻm** qarzdorlik va pochta xarajatlari toʻlovini undirish boʻyicha sud buyrugʻini chiqarishingizni;» | ✎ + F |
| | justify | 14 | «Ilova qilingan hujjatlar roʻyxati:» + 6 fixed items | K |
| Signature | left, space‑between | 14 b | «{chamberSignerPosition}   {chamberSignerName}» | ✎ (defaults) |
| Ijrochi | left | 10 | «Ijrochi: {chamberExecutorName}» | ✎ (default) |
| | left | 10 | «Telefon: {chamberExecutorPhone}» | ✎ (default) |
| QR | right of ijrochi | | «Ҳужжат ҳақиқийлигини текширинг / QR» + code | ours (signed only) |

The 6 fixed attachments: 1. Oʻz SSPga aʼzolik shartnomasi va guvoxnomasi nusxasi; 2. Arizani imzolash
vakolatini beruvchi ishonchnoma nusxasi; 3. Kredit shartnomasi nusxasi; 4. Ogohlantirish xatlari nusxasi;
5. Kredit toʻlash grafigi nusxasi; 6. Pochta xarajat toʻlanganligi haqida toʻlov topshiriqnoma.

### 4.2 Latin script — new core helpers

`core/document.ts` gets Latin siblings of the Cyrillic date helpers (the Cyrillic ones stay for the
maʼlumotnoma):

- `UZ_MONTHS_LATIN` = `['yanvar','fevral','mart','aprel','may','iyun','iyul','avgust','sentabr','oktabr','noyabr','dekabr']`
- `uzLongDateLatin(date)` → «2026 yil 15 iyul», and `uzLongDateLatinToIso(text)` (inverse, forgiving of
  spacing/case; empty on anything not a whole day — same contract as the Cyrillic one).
- Header date `arizaHeaderDate(date)` → «"15"  iyul 2026-yil».
- Latin contract phrase: «{DD.MM.YYYY}-yildagi {number}-sonli», comma‑separated, **not** bold (the blank
  bolds the number in the maʼlumotnoma but not here).

### 4.3 Decimal money

Debt amounts carry tiyin («24 318 882,63» = space thousands, comma decimal). Add
`formatSumDecimal(value)` → groups the integer part with spaces and joins the 2‑dp fraction with a comma,
and a decimal‑aware input mask for the editor. `loanAmount` in the ariza is whole («24 900 000») but the
same formatter renders it fine (no fraction → no comma). Stored as `Decimal(18,2)`.

### 4.4 «Jami qarzdorligi» — stored, auto‑summed

`debtTotal` is a real, stored red field (per the blank). In the **editor** it auto‑fills live as the sum
of the four components as they are typed, but remains editable (a clerk can override for a rounding/fee
case). This keeps «red = a saved field» while removing the common arithmetic error. The document and
point 2 of SOʻRAYMIZ both print `debtTotal`.

## 5. Editing & reuse

- **Draft history generalised.** `useCertDraft`/`reduceDraft` in `DocumentEdit.tsx` are value‑agnostic
  (they diff `Object.keys` and array‑shuffle history); generalise them to `useDraft<T>`/`reduceDraft<T>`
  so both `CertDraft` and a new `ArizaDraft` reuse the exact undo/localStorage machinery. The slot
  components (`EditableText`, `EditableValue`, `EditableContracts`) are already fully generic and are
  reused verbatim.
- **`ArizaDraft`** interface: `courtName, personFullName, personPinfl, personAddress, personPhone,
  contracts[], contractType, interestRate, loanAmount, asOfDate, asOfText, debtPrincipal,
  debtTermInterest, debtOverduePrincipal, debtOverdueInterest, debtTotal, chamberSignerPosition,
  chamberSignerName, chamberExecutorName, chamberExecutorPhone, issueDate`.
- **`arizaEditSlots(draft, opts): CourtArizaEdit`** — the analogue of `certificateEditSlots`, built in
  `DocumentEdit.tsx` so a test can hand the same slots to `CourtArizaDocument` and assert the editing view
  and the printed page say the same words (the invariant that guards against a screen that disagrees with
  the frozen PDF).
- **`arizaDraftProblems(draft)`** — validation in page order: courtName, personFullName, personPinfl
  (14 digits), personAddress, personPhone, ≥1 contract (each number+date, valid day), interestRate,
  loanAmount>0, asOfText (Latin‑parseable), each of the 4 debt components ≥0, debtTotal>0, issueDate.
  Passport is **not** required here (ariza has none).
- **`CertSheetEditor`** is generalised (or a thin `ArizaSheetEditor` wrapper) to host either document: the
  toolbar «Shartnoma» add stays; the maʼlumotnoma‑only «Sugʻurta» button is hidden for arizas; a debt
  block lives in the sheet. The one‑page overflow warning is **off** for arizas (they are legitimately two
  pages).
- **Labels** (`core/labels.ts`): `CertField` union and `CERT_FIELD_LABELS` gain the ariza fields, so a
  missing‑field API error and an in‑sheet slot name stay one list.

## 6. PDF, numbering, QR, public, workflow

- **PDF** (`pdf/html.tsx`, `pdf/ensure.ts`): add `courtArizaHtml(props)` (renders `CourtArizaDocument`);
  `ensureCertificatePdf`/`buildCertificatePdf` branch on `cert.docType` to pick the component and prop
  mapping. Sheet CSS `.cert-sheet` is shared; the ariza simply grows past 297 mm and Chromium paginates.
- **Numbering**: arizas need their own sequence and format ending `/09-02` (a fixed department code). Add
  `formatArizaNumber(seq)` → «{NNNN}/09-02» and `nextArizaNumber`/`peekArizaNumber` on a Counter key
  `ariza:{YYYY}` (a per‑year register). Same atomic‑increment, never‑reused guarantee as the maʼlumotnoma.
  **Open item — confirm the register scheme** (per‑year vs per‑day vs global running number); the code
  isolates it to one `counterId`/format pair, so changing it is local.
- **API**: `certificates` `POST`/`PATCH` branch on `b.docType`. For an ariza: required set is the ariza
  fields (no passport); `Client` upsert keys on PINFL and writes `fullName/address/phone`; the create
  writes the ariza columns; number comes from `nextArizaNumber`. Firm‑snapshot, submit→ADMIN_REVIEW and
  events are identical.
- **QR + public page** (`web-public/m/[id]`) and **admin review / rahbar sign** screens render
  `CourtArizaDocument` when `docType = ARIZA`, else `CertificateDocument`. Everything else in those flows
  is type‑agnostic.

## 7. UI — creation flow and list

- **Creation entry «Hujjat yaratish».** Both types need a firm, so the firm picker (the (app) sidebar)
  stays. After a firm is chosen the yurist picks the document: two cards — **«Maʼlumotnoma»** and
  **«Savdo-sanoat palatasiga ariza»** — routing to `/arizalar/yangi/{firmId}/malumotnoma` and
  `/…/ariza` respectively (exact routing finalised during planning). The maʼlumotnoma path is the current
  behaviour, just one click deeper. *(Layout/UX of the picker is the one piece worth confirming visually
  during implementation.)*
- **List** (`/arizalar`): shows both types with a **«Hujjat turi»** badge (Maʼlumotnoma / Ariza) and a
  type filter. The URL keeps the name `arizalar`.
- Admin/rahbar/public screens are unchanged except for the render branch in §6.

## 8. Testing (mirrors the existing suite)

1. **Editing == printing** (the key one): hand `arizaEditSlots` to `CourtArizaDocument` and assert the
   edited markup and the printed markup contain the same values — the same guard the maʼlumotnoma has.
2. **`arizaDraftProblems`**: each missing/malformed field reported once, in page order; passport absence
   is *not* an error for an ariza; a valid full draft yields no problems.
3. **Latin date helpers**: `uzLongDateLatin`/`uzLongDateLatinToIso` round‑trip; «31 fevral» → empty;
   forgiving of case/spacing.
4. **`formatSumDecimal`**: «24318882.63» → «24 318 882,63»; whole → no comma; grouping.
5. **`formatArizaNumber`** + the auto‑summed `debtTotal` (sum of four parts; override respected).
6. **Type isolation**: no Cyrillic maʼlumotnoma sentence appears in the ariza render and no ariza sentence
   («SOʻRAYMIZ», court, chamber) appears in the maʼlumotnoma render.
7. **PDF branch**: `courtArizaHtml` produces a standalone document containing the debtor, court, firm and
   debt figures.

Node/happy‑dom split as today; `npx tsc --noEmit` per package; `npm run db:push` for the schema.

## 9. Open items (isolated, low‑risk)

- **Ariza register/number scheme** (§6) — default is per‑year «{NNNN}/09-02»; confirm with the user.
- **Creation‑picker layout** (§7) — confirm visually during implementation.
- Firms used in arizas must have a **Latin `letterheadName`** and `bankAccount`/`mfo`/`stir` set (admin
  already manages these; the ariza uses `letterheadName`, not the Cyrillic `name`).
